// src/utils/linkMappings.js
export const linkMappings = {
  'LinkedIn': { url: 'https://www.linkedin.com/in/petersen-matthew/', image: '/images/linkedin.png' },
  'GitHub Portfolio': { url: 'https://github.com/petersenmatthew', image: '/images/github.png' },
  '@mmptrsn': { url: 'https://twitter.com/mmptrsn', image: '/images/twitter.png' },
  '@mxtthewpetersen': { url: 'https://instagram.com/mxtthewpetersen', image: '/images/4sight.png' },
  'matthewp@uwaterloo.ca': { url: 'mailto:matthewp@uwaterloo.ca'},
  'Schulich Leader Scholarship': { url: 'https://schulichleaders.com/', image: '/images/schulichleaders.png' },
  '4Sight': { url: 'https://github.com/justinwuzijin/eye-tester-app', image: '/images/4sight.png' },
  'Project WhyFi': {url: 'https://projectwhyfi.ca/', image: '/images/projectwhyfi.png'}
};

export function convertPhrasesToLinks(text) {
    const simpleLinkMappings = Object.fromEntries(
      Object.entries(linkMappings).map(([phrase, data]) => [phrase, data.url])
    );
  
    let result = text;
  
    Object.entries(simpleLinkMappings).forEach(([phrase, url]) => {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
      // Only match if not already inside an anchor tag
      const regex = phrase.startsWith('@')
        ? new RegExp(`(?<!["'>])${escaped}(?![^<]*</a>)`, 'gi')
        : new RegExp(`\\b${escaped}\\b(?![^<]*</a>)`, 'gi');
  
      result = result.replace(
        regex,
        `<a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;color:#3b82f6;">${phrase}</a>`
      );
    });
  
    return result;
  }
  