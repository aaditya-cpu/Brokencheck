import { LinkChecker } from 'linkinator';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';

// Array of domains
const domains = [
    'http://aatmdeepvidyalaya.com',
    'http://akcschool.in',
    'http://akshatinternationalujjain.com',
    'http://alpineujjain.com',
    'http://anandiacademy.com',
    'http://automation.nitiraj.net',
    'http://bafnalaw.com',
    'http://blog.eschoolapp.in',
    'http://blogsbysukhveer.com',
    'http://bpworldschool.com',
    'http://brainworkspreschool.com',
    'http://carmelmanasa.com',
    'http://dgagrawalschool.com',
    'http://dgagrawalschoolcpd.in',
    'http://dgaglobal.in',
    'http://drmpsfaridpur.in',
    'http://dwpsdhar.com',
    'http://egrapublicschool.in',
    'http://eschoolapp.in',
    'http://geniusglobalschool.co.in',
    'http://gihshyd.com',
    'http://gurukulvbs.com',
    'http://giridharimurtisculpture.com',
    'http://tejashri.dhanuka.info',
    'http://hgil.in',
    'http://himalayaintercollege.com',
    'http://idcards.eschoolapp.in',
    'http://ijhacademy.com',
    'http://ipropertymanagement.in',
    'http://ishaan.dhanuka.info',
    'http://jollymemorialmissionschoolujjain.com',
    'http://jupiterinternationalschool.com',
    'http://kadambinichildrensacademy.com',
    'http://kashievents.com',
    'http://keninternationalschool.in',
    'http://kidsgurukul.com',
    'http://ksfoods.org',
    'http://laxmicotspin.com',
    'http://ltedcollege.org',
    'http://masterthemarket.in',
    'http://matematikaclasses.com',
    'http://mrsoftwares.in',
    'http://muskanschool.in',
    'http://natkhatkids.in',
    'http://neuronlabsschool.org',
    'http://nitiraj.net',
    'http://npsindore.edu.in',
    'https://pragyaschoolgulabpura.com',
    'http://pragyacollege.com',
    'http://pragyaschool.com',
    'http://premghan.com',
    'http://pumpkinbox.in',
    'http://rainbow.gihshyd.com',
    'http://rainbowindiaschool.in',
    'http://ranibhabani.com',
    'http://revatiorganics.in',
    'http://rpsajmer.co.in',
    'http://sairamintschool.com',
    'http://saischooleducation.com',
    'http://scsapp.in',
    'http://sdinternational.co.in',
    'http://sdpskushinagar.com',
    'http://seminar.learnatijh.com',
    'http://semsgrp.in',
    'http://shamgoldenacademy.com',
    'http://shramdoot.in',
    'http://steppingstonesblp.com',
    'http://stthomasschooldhakuakhana.org',
    'http://svmacademy.co.in',
    'http://tejashri.dhanuka.info',
    'http://thecrescentschool.co.in',
    'http://theglobalchamps.com',
    'http://thelegendschool.in',
    'http://treehousehighschool.com',
    'http://treehouselifeskills.com',
    'http://treehouseonline.in',
    'http://treehouseplaygroup.net',
    'http://uipsujjain.com',
    'http://universal-arts.in',
    'http://wp.eschoolapp.in',
    'http://yashgroupofinstitutes.org',
    'http://youngartist.in'
  ];
  
// CSV writer for the output
const csvWriter = createCsvWriter({
    path: 'broken-links-report.csv',
    header: [
      { id: 'source', title: 'Source Domain' },
      { id: 'page', title: 'Page URL' },
      { id: 'error', title: 'Error Code' },
      { id: 'assetType', title: 'Asset Type' }
    ]
  });
  
  // Function to check a single domain
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
        console.log(`Broken link found: ${url} (Status: ${status})`);
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
      concurrency: 10, // Adjust concurrency as needed
      retry: true, // Enable retry for 429 status
      timeout: 100000, // Set timeout to 10 seconds per request
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
    };
  
    // Execute the scan
    await checker.check(options);
  
    return brokenLinks;
  }
  
  // Main function to loop through all domains one by one
  async function processDomains(domains) {
    const allBrokenLinks = [];
  
    for (const domain of domains) {
      try {
        const brokenLinks = await checkDomain(domain);
        if (brokenLinks.length > 0) {
          allBrokenLinks.push(...brokenLinks);
        }
      } catch (error) {
        console.error(`Error scanning domain ${domain}: ${error.message}`);
      }
    }
  
    // Write results to CSV
    if (allBrokenLinks.length > 0) {
      await csvWriter.writeRecords(allBrokenLinks);
      console.log('Broken links report saved to broken-links-report.csv');
    } else {
      console.log('No broken links found.');
    }
  }
  
  // Start the process
  processDomains(domains);