import $ from 'jquery';

const URL = 'https://projets.occitech.fr';

function APICall(apiKey, resource, params) {
	params = params || { };
	params.key = apiKey;

	return $.get(URL + resource, params);
}

function groupIssuesByVersion(issues) {
	return issues.reduce((groupedIssues, issue) => {
		const version = issue.fixed_version || { id: 'none', name: 'Sans version' };

		if (!groupedIssues.hasOwnProperty(version.id)) {
			groupedIssues[version.id] = {
				name: version.name,
				issues: []
			};
		}

		groupedIssues[version.id].issues.push(issue);
		return groupedIssues;
	}, {});
}

export {
	APICall,
	URL,
	groupIssuesByVersion
}
