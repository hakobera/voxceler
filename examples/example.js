var renderer;

window.addEventListener('DOMContentLoaded', function() {
	renderer = new Voxceler.Renderer();
	renderer.render();

	var message = document.getElementById('message');
	if (window.FileReader) {
		message.innerText = 'Drop image file to the box below.'
	}

});