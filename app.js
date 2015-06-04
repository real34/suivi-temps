import $ from 'jquery';
import Bacon from 'baconjs';

$.fn.asEventStream = Bacon.$.asEventStream;

const redmineURL = 'http://projets.occitech.fr';

const projectSelector = $('#projet');
const versionSelector = $('#version');
const issuesContainer = $('#results');

function configuration(field, localStorageKey) {
	let config = field.asEventStream('change')
		.map('.target.value')
		.toProperty(localStorage.getItem(localStorageKey));

	config.onValue((key) => localStorage.setItem(localStorageKey, key));
	config.onValue((key) => field.val(key));
	return config;
}

let redmineApiKey = configuration($('[name=redmine]'), 'redmineApiKey');
let togglApiKey = configuration($('[name=toggl]'), 'togglApiKey');

function redmineAPICall(apiKey, resource, params) {
	params = params || { };
	params.key = apiKey;

	return $.get(redmineURL + resource, params);
}

function togglReportsAPICall(apiKey, resource, params) {
	const url = 'https://toggl.com/reports/api/v2';

	params = params || {};
	params.user_agent = "pierre@occitech.fr";
	params.workspace_id = 127309;

	return $.ajax({
		url: url + resource,
		data: params,
		headers: {
			// see http://stackoverflow.com/a/5507289
			"Authorization": "Basic " + btoa(`${apiKey}:api_token`)
		},
	});
}

function notEmpty(val) {
	return val !== "";
}

let projets = redmineApiKey
	.filter(notEmpty)
	.flatMapLatest((apiKey) => Bacon.fromPromise(redmineAPICall(apiKey, '/projects.json', { limit: 100 })))
	.map('.projects');

function updateSelect(elt, valueKey, labelKey) {
	valueKey = valueKey || 'id';
	labelKey = labelKey || 'name';
	return function(source) {
		elt.find('option').remove();
		elt.append('<option value="">----</option>');
		source.map((item) => elt.append(`<option value="${item[valueKey]}">${item[labelKey]}</option>`))
	}
}

projets.onValue(updateSelect(projectSelector));

let issues = projectSelector.asEventStream('change')
	.map((e) => $(e.target).val())
	.combine(redmineApiKey, function(projectId, apiKey) {
		return { projectId: projectId, apiKey: apiKey };
	})
	.flatMapLatest((data) => Bacon.fromPromise(redmineAPICall(data.apiKey, '/issues.json', {
		limit: 100,
		project_id: data.projectId
	})))
	.map('.issues');

function groupByVersion(issues) {
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

let issuesByVersion = issues
	.map(groupByVersion);

function issueItem(issue) {
	let url = `${redmineURL}/issues/${issue.id}`;
	return `<li><a href="${url}" target="_blank">#${issue.id}</a> - ${issue.subject}</li>`
}

function updateIssues(issuesByVersion) {
	issuesContainer.html('');

	for (let versionId in issuesByVersion) {
		let version = issuesByVersion[versionId];
		let html = `
			<div class="version">
				<h2>${version.name}</h2>
				<ul>
					${version.issues.map(issueItem).join("\n")}
				<ul>
			</div>
		`;
		issuesContainer.append(html);
	};
}

issuesByVersion.onValue(updateIssues);

let versions = issuesByVersion
	.map((issuesByVersion) => {
		let versions = [];
		for (let versionId in issuesByVersion) {
			versions.push({
				id: issuesByVersion[versionId].id,
				name: issuesByVersion[versionId].name
			});
		}
		return versions;
	});

versions.onValue(updateSelect(versionSelector));

// let entries = togglApiKey
// 	.filter(notEmpty)
// 	.flatMapLatest((apiKey) => Bacon.fromPromise(togglReportsAPICall(apiKey, '/details')))
// 	.log('toggl');

