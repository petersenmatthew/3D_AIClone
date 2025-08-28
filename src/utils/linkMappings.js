// src/utils/linkMappings.js
export function convertPhrasesToLinks(text) {
    const linkMappings = {
      'LinkedIn': 'https://www.linkedin.com/in/petersen-matthew/',
      'GitHub Portfolio': 'https://github.com/petersenmatthew',
      'Personal Portfolio': 'https://matthewpetersen.com',
      'my portfolio': 'https://matthewpetersen.com',
      '@mmptrsn': 'https://twitter.com/mmptrsn',
      '@mxtthewpetersen': 'https://instagram.com/mxtthewpetersen',
      'matthewp@uwaterloo.ca': 'mailto:matthewp@uwaterloo.ca',
      'Schulich Leader Scholarship': 'https://schulichleaders.com/',
      '4Sight': 'https://github.com/justinwuzijin/eye-tester-app',
    };
  
    let result = text;
  
    Object.entries(linkMappings).forEach(([phrase, url]) => {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
      const regex = phrase.startsWith('@')
        ? new RegExp(`(?<!["'>])${escaped}`, 'gi')
        : new RegExp(`\\b${escaped}\\b(?![^<]*>)`, 'gi');
  
      result = result.replace(
        regex,
        `<a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;color:#3b82f6;">${phrase}</a>`
      );
    });
  
    return result;
  }
  