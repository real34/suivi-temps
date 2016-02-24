import { Observable } from 'rx'
import { run } from '@cycle/core'
import { makeDOMDriver, h1, h2, div, form, fieldset, legend, label, input, select, option } from '@cycle/dom'
import storageDriver from '@cycle/storage'

import * as Redmine from './redmine';
import * as Toggl from './toggl';

// TODO Use http driver instead of big jquery ajax calls ;)
// TODO isolate()
const locallyPersistedFieldWithLabel = ({storage, DOM}, fieldLabel, name) => {
	const value$ = storage.local
		.getItem(name)
		.startWith('')

	const vtree$ = value$.map(value => ([
		label({attributes: {'for': name}}, fieldLabel),
		input('#' + name, {attributes: {type: 'text', name, value, required: 'required'}})
	]))

	const storageRequest$ = DOM.select('#' + name)
		.events('keyup')
		.map(e => ({
			key: name,
			value: e.target.value
		}))

	return {DOM: vtree$, storage: storageRequest$, value$}
}

const notEmpty = val => val !== "";

const redmineProjectSelector = ({DOM}, redmineApiKey$) => {
	const value$ = DOM.select('#projet').events('change')
		.map(e => e.target.value)
		.startWith(false)
		.tap(v => console.debug('redmine proj', v))

	const projects$ = redmineApiKey$
		.flatMapLatest(apiKey => Observable.fromPromise(Redmine.APICall(apiKey, '/projects.json', { limit: 100 })))
		.map(response => response.projects)

	const vtree$ = projects$.map(projects => div('#selector', [
		h2('Sélectionnez un projet / une version à suivre'),
		label({attributes: {'for': 'projet'}}, 'Projet'),
		select(
			'#projet',
			{attributes: {name: 'projet', required: 'required'}},
			projects.map(project => option({attributes: {value: project.id}}, project.name))
		)
	]))

	return {
		DOM: vtree$,
		value$
	}
}

const App = (sources) => {
    const redmineInput = locallyPersistedFieldWithLabel(sources, 'Clé Redmine', 'redmineApiKey');
    const togglInput = locallyPersistedFieldWithLabel(sources, 'Clé Toggl', 'togglApiKey');

	const redmineApiKey$ = redmineInput.value$.filter(notEmpty);

	const projectSelector = redmineProjectSelector(sources, redmineApiKey$)

	const DOM = Observable.combineLatest(
		redmineInput.DOM, togglInput.DOM, projectSelector.DOM, projectSelector.value$,
		(redmineInput, togglInput, projectsSelector, pid) => div([
			h1('Suivi du temps'),
			form('#api_keys', [
				fieldset([
					legend('Vos clés API'),
					redmineInput,
					togglInput
				])
			]),
			projectsSelector,
			pid ? div('Vous avez sélectionné '+ pid) : div('#results', 'Veuillez sélectionner un projet')
		])
	);

	return {
		DOM,
		storage: Observable.merge(redmineInput.storage, togglInput.storage)
	}
}

run(App, {
	DOM: makeDOMDriver('#app'),
	storage: storageDriver
})

//import { configuration, notEmpty, updateSelect } from './helpers';
//import * as Redmine from './redmine';
//import * as Toggl from './toggl';

// http://www.wolfe.id.au/2015/08/08/development-with-webpack-and-docker/

//$.fn.asEventStream = Bacon.$.asEventStream;
//
//const projectSelector = $('#projet');
//const issuesContainer = $('#results');
//
//let issues = projectSelector.asEventStream('change')
//	.map((e) => $(e.target).val())
//	.combine(redmineApiKey, function(projectId, apiKey) {
//		return { projectId: projectId, apiKey: apiKey };
//	})
//	.flatMapLatest((data) => Bacon.fromPromise(Redmine.APICall(data.apiKey, '/issues.json', {
//		limit: 100,
//		project_id: data.projectId,
//		status_id: '*'
//	})))
//	.map('.issues');
//
//let issuesByVersion = issues
//	.map(Redmine.groupIssuesByVersion);
//
//function issueItem(issue) {
//	const url = `${Redmine.URL}/issues/${issue.id}`;
//	const estimation = issue.estimated_hours || 0;
//
//	return `<tr id="issue-${issue.id}">
//		<td>
//			<a href="${url}" target="_blank">#${issue.id}</a>
//		</td>
//		<td>${issue.subject}</td>
//		<td>${estimation}h</td>
//		<td>${issue.done_ratio}%</td>
//		<td>${issue.status.name}</td>
//		<td class="consommé">TBD</td>
//		<td class="facturable">TBD</td>
//		<td class="percent">TBD</td>
//		<td class="capital">TBD</td>
//	</tr>`;
//}
//
//function updateIssues(issuesByVersion) {
//	issuesContainer.html('');
//
//	for (let versionId in issuesByVersion) {
//		let version = issuesByVersion[versionId];
//		let html = `
//			<div class="version" data-id="${versionId}">
//				<h2>${version.name}</h2>
//				<button class="get-times">Zou</button>
//				<button onClick="alert('Coming soon')">Pam</button>
//				<table>
//					<thead>
//						<th>#id</th>
//						<th>Description</th>
//						<th>Estimé</th>
//						<th>% réalisé</th>
//						<th>Etat</th>
//						<th>Temps consommé</th>
//						<th>Temps facturable</th>
//						<th>% temps</th>
//						<th>Capital</th>
//					</thead>
//					</tbody>
//						${version.issues.map(issueItem).join("\n")}
//					</tbody>
//				</table>
//			</div>
//		`;
//		issuesContainer.append(html);
//	};
//}
//
//issuesByVersion.onValue(updateIssues);
//
//const refreshTimesForVersion = $('body')
//	.asEventStream('click', '.get-times')
//	.map(e => $(e.target).parent().data('id'));
//
//const issuesTimes = refreshTimesForVersion
//	.combine(issuesByVersion, (versionId, issuesByVersion) => {
//		return issuesByVersion[versionId].issues;
//	})
//	.combine(togglApiKey, (issues, togglApiKey) => ({ issues, togglApiKey }))
//	.flatMap(data => {
//		return Bacon.sequentially(300, data.issues)
//			.flatMap(issue => {
//				const params = {
//					description: `#${issue.id}`,
//					since: '2016-01-01'
//				};
//				return Bacon.fromPromise(Toggl.reportsAPICall(data.togglApiKey, '/details', params))
//					.map((toggl) => ({ total_grand: toggl.total_grand, total_billable: toggl.total_billable, redmine: issue }))
//			})
//	});
//
//issuesTimes.onValue(updateIssuesTime);
//
//function updateIssuesTime(issue) {
//	const capital = parseInt(toMilliseconds(issue.redmine.estimated_hours || 0) - issue.total_billable);
//	let percentage = parseInt((issue.total_billable / toMilliseconds(issue.redmine.estimated_hours)) * 100);
//	percentage = isNaN(percentage) ? 100 : percentage;
//
//	const isAlert = issue.redmine.done_ratio < percentage;
//	let styles = {
//		alert: {
//			"background-color": "red",
//			"color" : "#fff",
//			"font-weight": "bold"
//		},
//		normal: { "background-color": "#dedede" }
//	};
//
//	$(`#issue-${issue.redmine.id} .consommé`).html(toHumanDuration(issue.total_grand));
//	$(`#issue-${issue.redmine.id} .facturable`).html(toHumanDuration(issue.total_billable));
//	$(`#issue-${issue.redmine.id} .percent`).html(percentage + '%');
//	$(`#issue-${issue.redmine.id} .capital`).html(toHumanDuration(capital));
//	$(`#issue-${issue.redmine.id}`).css(isAlert ? styles.alert : styles.normal);
//}
//
//function toHumanDuration(time) {
//	let result = '';
//	let timeInMinutes = parseInt(time / 1000 / 60, 10);
//	let timeInHours = parseInt(timeInMinutes / 60, 10);
//
//	if (timeInHours) {
//		result += `${timeInHours}h`;
//	}
//
//	timeInMinutes -= timeInHours * 60;
//	result += `${timeInMinutes}m`;
//	return result;
//}
//
//function toMilliseconds(timeInHours) {
//	return timeInHours * 60 * 60 * 1000;
//}
