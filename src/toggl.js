import $ from 'jquery';

function reportsAPICall(apiKey, resource, params) {
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

export {
	reportsAPICall
}