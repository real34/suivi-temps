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

	return `<tr id="issue-${issue.id}">
		<td>
			<a href="${url}" target="_blank">#${issue.id}</a>
		</td>
		<td>${issue.subject}</td>
		<td>${estimation}h</td>
		<td>${issue.done_ratio}%</td>
		<td>${issue.status.name}</td>
		<td class="consommé">TBD</td>
		<td class="facturable">TBD</td>
		<td class="percent">TBD</td>
		<td class="capital">TBD</td>
	</tr>`;
}

function updateIssues(issuesByVersion) {
	issuesContainer.html('');

	for (let versionId in issuesByVersion) {
		let version = issuesByVersion[versionId];
		let html = `
			<div class="version" data-id="${versionId}">
				<h2>${version.name}</h2>
				<button class="get-times">Zou</button>
				<table>
					<thead>
						<th>#id</th>
						<th>Description</th>
						<th>Estimé</th>
						<th>% réalisé</th>
						<th>Etat</th>
						<th>Temps consommé</th>
						<th>Temps facturable</th>
						<th>% temps</th>
						<th>Capital</th>
					</thead>
					</tbody>
						${version.issues.map(issueItem).join("\n")}
					</tbody>
				</table>
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
		return issuesByVersion[versionId].issues;
	})
	.combine(togglApiKey, (issues, togglApiKey) => ({ issues, togglApiKey }))
	.flatMap(data => {
		return Bacon.sequentially(300, data.issues)
			.flatMap(issue => {
				const params = {
					description: `#${issue.id}`,
					since: '2015-01-01'
				};
				return Bacon.fromPromise(Toggl.reportsAPICall(data.togglApiKey, '/details', params))
					.map((toggl) => ({ total_grand: toggl.total_grand, total_billable: toggl.total_billable, redmine: issue }))
			})
	});

issuesTimes.onValue(updateIssuesTime);

function updateIssuesTime(issue) {
	const capital = parseInt(toMilliseconds(issue.redmine.estimated_hours || 0) - issue.total_billable);
	let percentage = parseInt((issue.total_billable / toMilliseconds(issue.redmine.estimated_hours)) * 100);
	percentage = isNaN(percentage) ? 100 : percentage;
	$(`#issue-${issue.redmine.id} .consommé`).html(toHumanDuration(issue.total_grand));
	$(`#issue-${issue.redmine.id} .facturable`).html(toHumanDuration(issue.total_billable));
	$(`#issue-${issue.redmine.id} .percent`).html(percentage + '%');
	$(`#issue-${issue.redmine.id} .capital`).html(toHumanDuration(capital));
}

function toHumanDuration(time) {
	let result = '';
	let timeInMinutes = parseInt(time / 1000 / 60, 10);
	let timeInHours = parseInt(timeInMinutes / 60, 10);

	if (timeInHours) {
		result += `${timeInHours}h`;
	}

	timeInMinutes -= timeInHours * 60;
	result += `${timeInMinutes}m`;
	return result;
}

function toMilliseconds(timeInHours) {
	return timeInHours * 60 * 60 * 1000;
}