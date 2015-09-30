function configuration(field, localStorageKey) {
	let config = field.asEventStream('change')
		.map('.target.value')
		.toProperty(localStorage.getItem(localStorageKey));

	config.onValue((key) => localStorage.setItem(localStorageKey, key));
	config.onValue((key) => field.val(key));
	return config;
}

function notEmpty(val) {
	return val !== "";
}

function updateSelect(elt, valueKey, labelKey) {
	valueKey = valueKey || 'id';
	labelKey = labelKey || 'name';
	return function(source) {
		elt.find('option').remove();
		elt.append('<option value="">----</option>');
		source.map((item) => elt.append(`<option value="${item[valueKey]}">${item[labelKey]}</option>`))
	}
}

export {
	configuration,
	notEmpty,
	updateSelect
} 