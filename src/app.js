import Yolk from 'yolk';
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
				<button onClick="alert('Coming soon')">Pam</button>
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

	const isAlert = issue.redmine.done_ratio < percentage;
	let styles = {
		alert: {
			"background-color": "red",
			"color" : "#fff",
			"font-weight": "bold"
		},
		normal: { "background-color": "#dedede" }
	};

	$(`#issue-${issue.redmine.id} .consommé`).html(toHumanDuration(issue.total_grand));
	$(`#issue-${issue.redmine.id} .facturable`).html(toHumanDuration(issue.total_billable));
	$(`#issue-${issue.redmine.id} .percent`).html(percentage + '%');
	$(`#issue-${issue.redmine.id} .capital`).html(toHumanDuration(capital));
	$(`#issue-${issue.redmine.id}`).css(isAlert ? styles.alert : styles.normal);
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

// Yolk Utils
function _emit(value, eventHandlerProp) {
	// See https://github.com/garbles/yolk/issues/7
	value.withLatestFrom(
		eventHandlerProp,
		(value, eventHandler) => eventHandler(value)
	).subscribe();
}

function App() {
	const settings = this.createEventHandler();
	const project = this.createEventHandler();

	settings.tap(e => console.debug('settings', e)).subscribe();

	return <div>
		<h1>Suivi du temps</h1>

		<Settings onChange={settings} />
		<ProjectSelector redmineApiKey={settings.redmineApiKey} onChange={project} />

		<TasksList project={project}/>
	</div>
}

function Settings({onChange}) {
	const redmineApi = this.createEventHandler();
	const togglApi = this.createEventHandler();
	
	const value = Yolk.Rx.Observable.combineLatest(
		redmineApi, togglApi,
		(redmineApi, togglApi) => ({redmineApi, togglApi})
	);
	_emit(value, onChange);

	return 	<form id="api_keys">
		<fieldset>
			<legend>Vos clés API</legend>
			<SettingsLocalStorageInput label="Clé Redmine" localStorageKey="redmineApiKey" onChange={redmineApi} helpUrl="http://projets.occitech.fr/my/account"/>
			<SettingsLocalStorageInput label="Clé Toggl" localStorageKey="togglApiKey" onChange={togglApi} helpUrl="https://toggl.com/app/profile"/>
		</fieldset>
	</form>
}

function SettingsLocalStorageInput({localStorageKey, label, helpUrl, onChange}) {
	const handleChange = this.createEventHandler();
	const value = handleChange
		.map(e => e.target.value)
		.merge(localStorageKey.map(key => localStorage.getItem(key)));

	value.withLatestFrom(
		localStorageKey,
		(value, key) => localStorage.setItem(key, value)
	).subscribe();
	_emit(value, onChange);

	const fieldName = localStorageKey.map(name => `local-${name}`);
	return <div>
		<label for={fieldName}>{label}</label>
		<input type="text" id={fieldName} value={value} required="required" onChange={handleChange}/>
		{helpUrl ? <a href={helpUrl} target="_blank">Par ici !</a> : ""}
	</div>
}

function ProjectSelector({redmineApiKey, onChange}) {
	return <div id="selector">
		<h2>Sélectionnez un projet</h2>

		<label for="projet">Projet</label>
		<select name="projet" id="projet" required="required">
			<option value="">----</option>
		</select>
	</div>
}

function TasksList({project}) {
	return <div id="results">
		{ project ? "Coucou" : "Veuillez sélectionner un projet" }
	</div>
}

Yolk.render(<App />, document.getElementById('app'));
