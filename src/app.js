import $ from 'jquery';
import Bacon from 'baconjs';
import { configuration, notEmpty, updateSelect } from './helpers';
import * as Redmine from './redmine';
import * as Toggl from './toggl';

// http://www.wolfe.id.au/2015/08/08/development-with-webpack-and-docker/

$.fn.asEventStream = Bacon.$.asEventStream;

const projectSelector = $('#projet');
const issuesContainer = $('#results');

let redmineApiKey = configuration($('[name=redmine]'), 'redmineApiKey');
let togglApiKey = configuration($('[name=toggl]'), 'togglApiKey');

let projets = redmineApiKey
	.filter(notEmpty)
	.flatMapLatest((apiKey) => Bacon.fromPromise(Redmine.APICall(apiKey, '/projects.json', { limit: 100 })))
	.map('.projects');

projets.onValue(updateSelect(projectSelector));

let issues = projectSelector.asEventStream('change')
	.map((e) => $(e.target).val())
	.combine(redmineApiKey, function(projectId, apiKey) {
		return { projectId: projectId, apiKey: apiKey };
	})
	.flatMapLatest((data) => Bacon.fromPromise(Redmine.APICall(data.apiKey, '/issues.json', {
		limit: 100,
		project_id: data.projectId,
		status_id: '*'
	})))
	.map('.issues');

let issuesByVersion = issues
	.map(Redmine.groupIssuesByVersion);

function issueItem(issue) {
	const url = `${Redmine.URL}/issues/${issue.id}`;
	const estimation = issue.estimated_hours || 0;

	return `<li id="issue-${issue.id}" style="max-width: 700px">
		<a href="${url}" target="_blank">#${issue.id}</a>
		- ${issue.subject}
		<span class="estimation">(Estimé : ${estimation}h)</span>
		<span class="effectif" style="float:right">TBD</span>
	</li>`;
}

function updateIssues(issuesByVersion) {
	issuesContainer.html('');

	for (let versionId in issuesByVersion) {
		let version = issuesByVersion[versionId];
		let html = `
			<div class="version" data-id="${versionId}">
				<h2>${version.name}</h2>
				<button class="get-times">Zou</button>
				<ul>
					${version.issues.map(issueItem).join("\n")}
				<ul>
			</div>
		`;
		issuesContainer.append(html);
	};
}

issuesByVersion.onValue(updateIssues);

const refreshTimesForVersion = $('body')
	.asEventStream('click', '.get-times')
	.map(e => $(e.target).parent().data('id'));

const issuesTimes = refreshTimesForVersion
	.combine(issuesByVersion, (versionId, issuesByVersion) => {
		return issuesByVersion[versionId].issues.map(issue => issue.id);
	})
	.combine(togglApiKey, (issues, togglApiKey) => ({ issues, togglApiKey }))
	.flatMap(data => {
		return Bacon.fromArray(data.issues)
			// .delay(100) TODO Fix me
			.flatMap(issueId => {
				const params = {
					description: `#${issueId}`
				};
				return Bacon.fromPromise(Toggl.reportsAPICall(data.togglApiKey, '/details', params))
					.map((toggl) => ({ total_grand: toggl.total_grand, total_billable: toggl.total_billable, id: issueId }))
			})
	});

issuesTimes.onValue(updateIssuesTime);

function updateIssuesTime(issue) {
	$(`#issue-${issue.id} .effectif`).html(`<strong>${toHumanDuration(issue.total_billable)}</strong> / ${toHumanDuration(issue.total_grand)}`);
}

function toHumanDuration(time) {
	return parseInt(time / 1000 / 60, 10) + 'm';
}