'use es6';
const fs = require('fs');

const fetchData = (url) => {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error(`failed! status code: ${response.statusCode}`));
      }
      const body = [];
      response.on('data', (chunk) => body.push(chunk));
      response.on('end', () => resolve(body.join('')));
    });
    request.on('error', (err) => reject(err));
  })
};

const writePrettySnippetJson = (filePath, snippetJson) => {
  fs.writeFile(`./snippets/${filePath}.json`, snippetJson, (err) => {
    if(err) {
      return console.log(err);
    }
    console.log(`File saved as ${filePath}`);
  })
}

const endBlocker = (name, label, params, contents='\n') => {
  return `{% ${name} "${label}" ${params} %}\n\t${contents}\n{% end${name.includes("_")
    ? '_' + name + '%}'
		: name + '%}'} `;
}

fetchData('https://api.hubspot.com/cos-rendering/v1/hubldoc')
  .then((data) => JSON.parse(data))
  .then((hubl) => {
    let output = {};
    Object.keys(hubl).forEach((parentType) => {
      output[parentType]= {};
      Object.keys(hubl[parentType]).forEach((childType) => {
        const childEntry = hubl[parentType][childType];
        const paramString = childEntry['params'].length > 0
          ? parentType === 'tags'
            ? '\n\t' + childEntry.params.map(param => `\${${param.name}}=\${${param.defaultValue.length
							? param.defaultValue : 'NO_DEFAULT'}}`).join("\n\t")
							: `(${childEntry.params.map((param, i) => "${" + param.name + "}").join(", ")})`
          : false;
        const paramStringDesc = childEntry['params'].length > 0
					? "\n Available Parameters: \n\t- " + childEntry.params
						.map(param => `${param.name}(${param.type}): ${param.desc}`).join("\n\n\t- ")
					: `\n(no documented parameters)`;
        output[parentType][childType] = {}; // I feel like I could use Object.assign() somewhere here to DRY this up.
				output[parentType][childType]['name'] = childEntry.name;
				if (parentType === 'expTests') {
					output[parentType][childType]['body'] = childEntry.snippets.length > 0 ? childEntry.snippets[0].code	: childEntry.name				
				} else {
					output[parentType][childType]['body'] = childEntry.snippets.length > 0
						? childEntry.snippets[0]['code'].includes('{% end')
							? endBlocker(childEntry.name, childEntry.name, paramString) : childEntry.name + paramString
						: childEntry.name
				}
        output[parentType][childType]['description'] = childEntry.desc + paramStringDesc;
        output[parentType][childType]['prefix'] = `${parentType == 'filters' ? "|" : "~"}` + childEntry.name
      })
    })
    Object.keys(output).forEach((type) => {writePrettySnippetJson(`hubl_${type}`, JSON.stringify(output[type], null, 4))})
  })
  .catch((err) => console.log(err));
