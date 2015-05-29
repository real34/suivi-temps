import $ from 'jquery';
import Bacon from 'baconjs';

$.fn.asEventStream = Bacon.$.asEventStream;

const projectSelector = $('#projet');
const versionSelector = $('#version');

let redmineApiKey = $('[name=redmine]').asEventStream('change')
	.map('.target.value')
	.toProperty(localStorage.getItem('redmineApiKey'));

redmineApiKey.onValue((key) => localStorage.setItem("redmineApiKey", key));
redmineApiKey.onValue((key) => $('[name=redmine]').val(key));

let togglApiKey = $('[name=toggl]')
	.asEventStream('change')
	.map('.target.value')
	.toProperty(localStorage.getItem('togglApiKey'));
togglApiKey.onValue((key) => localStorage.setItem("togglApiKey", key));
togglApiKey.onValue((key) => $('[name=toggl]').val(key));

function redmineAPICall(apiKey, resource, params) {
	const url = 'http://projets.occitech.fr';

	params = params || { };
	params.key = apiKey;

	return $.get(url + resource, params);
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
			"Authorization": "Basic " + btoa(apiKey + ":" + 'api_token')
		},
	});
}

function notEmpty(val) {
	return val !== "";
}

let projets = redmineApiKey
	.filter(notEmpty)
	.flatMap((apiKey) => Bacon.fromPromise(redmineAPICall(apiKey, '/projects.json', { limit: 100 })))
	.map('.projects');

function updateSelect(elt, valueKey, labelKey) {
	valueKey = valueKey || 'id';
	labelKey = labelKey || 'name';
	return function(source) {
		elt.find('option').remove();
		elt.append('<option value="">----</option>');
		source.map((item) => elt.append('<option value="' + item[valueKey] + '">' + item[labelKey] + '</option>'))
	}
}

projets.onValue(updateSelect(projectSelector));

let versions = projectSelector.asEventStream('change')
	.map((e) => $(e.target).val())
	.filter(notEmpty)
	.combine(redmineApiKey, function(projectId, apiKey) {
		return { projectId: projectId, apiKey: apiKey };
	})
	.flatMap((data) => Bacon.fromPromise(redmineAPICall(data.apiKey, '/projects/' + data.projectId + '/versions.json', { limit: 100 })))
	.map('.versions');

versions.onValue(updateSelect(versionSelector));

let entries = togglApiKey
	.filter(notEmpty)
	.flatMap((apiKey) => Bacon.fromPromise(togglReportsAPICall(apiKey, '/details')))
	.log('toggl');

