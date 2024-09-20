import { LinkChecker } from 'linkinator';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Retry logic to handle requests with status 0
const retryWithDelay = async (fn, retries = 3, delayMs = 300000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`Attempt ${i + 1} failed with status 0. Retrying in ${delayMs / 60000} minutes...`);
      if (i === retries - 1) {
        console.error(`Final retry failed for status 0. Skipping link.`);
        return null; // Return null after final retry failure to avoid throwing an error
      }
      await new Promise(res => setTimeout(res, delayMs)); // Wait before retrying
    }
  }
};

const domains = [
  'http://aatmdeepvidyalaya.com',
  'http://akcschool.in',
  'http://akshatinternationalujjain.com',
 
];

// CSV writer for the output
const csvWriter = createCsvWriter({
  path: 'combined-report.csv',
  header: [
    { id: 'source', title: 'Source Domain' },
    { id: 'page', title: 'Page URL' },
    { id: 'error', title: 'Error Code' },
    { id: 'assetType', title: 'Asset Type' },
    { id: 'desktopPerformanceScore', title: 'Desktop Performance Score' },
    { id: 'desktopIssues', title: 'Desktop Issues' },
    { id: 'mobilePerformanceScore', title: 'Mobile Performance Score' },
    { id: 'mobileIssues', title: 'Mobile Issues' }
  ]
});

// Function to parse and generate recommendations from Lighthouse results
function parseLighthouseIssues(lighthouseResult) {
  const performanceAudits = lighthouseResult.audits;
  const actionableItems = [];

  // Example audits related to performance (you can expand this list as needed)
  const keyAudits = [
    { id: 'first-contentful-paint', description: 'First Contentful Paint (FCP): Aim to load critical content as quickly as possible.', suggestion: 'Consider optimizing images and using lazy loading.' },
    { id: 'speed-index', description: 'Speed Index: Measures how quickly content is visually displayed.', suggestion: 'Reduce unused CSS, minimize render-blocking resources, and defer non-critical JS.' },
    { id: 'largest-contentful-paint', description: 'Largest Contentful Paint (LCP): Measures the time it takes for the largest content element to load.', suggestion: 'Optimize images, use a CDN, and reduce server response times.' },
    { id: 'total-blocking-time', description: 'Total Blocking Time (TBT): Measures the time during which the main thread is blocked and unable to respond to user input.', suggestion: 'Minimize JavaScript execution time, avoid long tasks, and split large tasks into smaller ones.' },
    { id: 'cumulative-layout-shift', description: 'Cumulative Layout Shift (CLS): Measures unexpected layout shifts during page load.', suggestion: 'Ensure images have explicit width and height, avoid injecting ads above existing content.' }
  ];

  keyAudits.forEach(({ id, description, suggestion }) => {
    const audit = performanceAudits[id];
    if (audit && audit.score !== null && audit.score < 1) {
      actionableItems.push({
        description,
        score: audit.score * 100,
        suggestion
      });
    }
  });

  if (actionableItems.length === 0) {
    return 'No significant issues detected.';
  }

  // Construct detailed recommendations string
  return actionableItems.map(item => `${item.description} (Score: ${item.score}): ${item.suggestion}`).join('; ');
}

// Function to run Lighthouse for desktop performance
async function runLighthouseDesktop(domain) {
  try {
    const { stdout } = await execPromise(
      `lighthouse ${domain} --output json --quiet --preset=desktop --chrome-flags="--headless"`,
      { maxBuffer: 1024 * 1024 * 10 } // Set max buffer size to 10MB
    );
    const lighthouseResult = JSON.parse(stdout);
    const performanceScore = lighthouseResult.categories.performance.score * 100;
    const issues = parseLighthouseIssues(lighthouseResult);
    return { performanceScore, issues };
  } catch (error) {
    console.error(`Error running Lighthouse (Desktop) for ${domain}: ${error.message}`);
    return { performanceScore: 'N/A', issues: 'Failed to run Lighthouse (Desktop)' };
  }
}

// Function to run Lighthouse for mobile performance
async function runLighthouseMobile(domain) {
  try {
    const { stdout } = await execPromise(
      `lighthouse ${domain} --output json --quiet --chrome-flags="--headless" --form-factor=mobile`,
      { maxBuffer: 1024 * 1024 * 10 } // Set max buffer size to 10MB
    );
    const lighthouseResult = JSON.parse(stdout);
    const performanceScore = lighthouseResult.categories.performance.score * 100;
    const issues = parseLighthouseIssues(lighthouseResult);
    return { performanceScore, issues };
  } catch (error) {
    console.error(`Error running Lighthouse (Mobile) for ${domain}: ${error.message}`);
    return { performanceScore: 'N/A', issues: 'Failed to run Lighthouse (Mobile)' };
  }
}

// Function to check a single domain for broken links using Linkinator
async function checkDomain(domain) {
  console.log(`Starting scan for domain: ${domain}`);
  const brokenLinks = [];

  const checker = new LinkChecker();

  checker.on('pagestart', (url) => {
    console.log(`Scanning page: ${url}`);
  });

  checker.on('link', (result) => {
    const { url, state, status, contentType } = result;

    if (state === 'BROKEN') {
      if (status === 0) {
        console.log(`Status 0 found for ${url}. Will retry.`);
      } else {
        console.log(`Broken link found: ${url} (Status: ${status})`);
      }
      brokenLinks.push({
        source: domain,
        page: url,
        error: status,
        assetType: contentType || 'unknown'
      });
    }
  });

  const options = {
    path: domain,
    recurse: true,
    concurrency: 5,
    retry: true,
    timeout: 100000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
  };

  // Execute the scan
  await checker.check(options);

  return brokenLinks;
}

// Retry logic for broken links with status 0
async function retryBrokenLinks(brokenLinks, domain) {
  const retryResults = [];

  for (const link of brokenLinks) {
    if (link.error === 0) {
      try {
        const retryResult = await retryWithDelay(async () => {
          const checker = new LinkChecker();
          let retryStatus = null;
          checker.on('link', (result) => {
            const { url, state, status } = result;
            if (state === 'BROKEN' && status === 0) {
              console.log(`Retry for ${url} failed again with status 0.`);
              retryStatus = 0; // Indicate that retry failed again
            } else {
              console.log(`Retry successful for: ${url} (Status: ${status})`);
              retryStatus = status;
            }
          });

          const options = {
            path: link.page,
            concurrency: 1, // Low concurrency for retries
            retry: true,
            timeout: 100000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
          };

          await checker.check(options);
          return retryStatus;
        });

        if (retryResult !== null) {
          retryResults.push({
            ...link,
            error: retryResult
          });
        } else {
          retryResults.push(link); // If retry failed after max attempts, keep original status 0
        }
      } catch (err) {
        console.error(`Failed to recover link: ${link.page} after retries`);
        retryResults.push(link); // Add failed link after retries
      }
    } else {
      retryResults.push(link); // Add non-status 0 links without retry
    }
  }

  return retryResults;
}
// Array of domains// Main function to loop through all domains and process both Linkinator and Lighthouse results
async function processDomains(domains) {
  const allResults = [];

  for (const domain of domains) {
    try {
      // 1. Check broken links with Linkinator
      const brokenLinks = await checkDomain(domain);

      // 2. Retry broken links with status 0
      const retriedLinks = await retryBrokenLinks(brokenLinks, domain);

      // 3. Run Lighthouse for desktop (Ethernet)
      const { performanceScore: desktopPerformanceScore, issues: desktopIssues } = await runLighthouseDesktop(domain);

      // 4. Run Lighthouse for mobile (4G)
      const { performanceScore: mobilePerformanceScore, issues: mobileIssues } = await runLighthouseMobile(domain);

      // 5. Consolidate results and push to final array
      retriedLinks.forEach(link => {
        allResults.push({
          source: domain,
          page: link.page,
          error: link.error,
          assetType: link.assetType,
          desktopPerformanceScore,
          desktopIssues,
          mobilePerformanceScore,
          mobileIssues
        });
      });

      console.log(`Completed processing for domain: ${domain}`);
    } catch (error) {
      console.error(`Error processing domain ${domain}: ${error.message}`);
    }
  }

  // Write results to CSV
  if (allResults.length > 0) {
    await csvWriter.writeRecords(allResults);
    console.log('Combined report saved to combined-report.csv');
  } else {
    console.log('No results to report.');
  }
}

// Start the process
processDomains(domains);