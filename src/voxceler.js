/**
 * voxceler.js - Lightweight voxcel rendering engine using Three.js.
 *
 * Copyright 2011 Kazuyuki Honda <hakobera@gmail.com>
 */

//-----------------------------------------------------------------------------
// Namespace.
//-----------------------------------------------------------------------------
var Voxceler = Voxceler || {};

//-----------------------------------------------------------------------------
// Constants.
//-----------------------------------------------------------------------------

/**
 * Voxcel unit size.
 *
 * @constant
 * @type {Number}
 */
Voxceler.VOXCEL_UNIT_SIZE = 50;

/**
 * Image loading information element id attribute value.
 *
 * @constant
 * @type {String}
 */
Voxceler.LOADING_INFO_ELEMENT_ID = 'voxceler-loadingInfo';

//-----------------------------------------------------------------------------
// Class properties.
//-----------------------------------------------------------------------------

/**
 * Debug flag.
 * If 'true' is set, Voxceler print debug message for development use.
 *
 * @property
 * @type {Boolean}
 */
Voxceler.isDebug = false;

/**
 * WebGL Support or not flag.
 */
Voxceler.hasWebGL = (function(global) {
	var	contentIds = ['experimental-webgl', 'moz-webgl', 'webkit-3d', 'webgl', '3d'],
			length = contentIds.length,
			canvas, context, i;

	canvas = document.createElement('canvas');
	if (canvas) {
		for (i = 0; i < length; ++i) {
			try {
				context = canvas.getContext(contentIds[i]);
				if (context) {
					return true;
				}
			} catch (err) {
				continue;
			}
		}
	}
	return false;
})(this);

//-----------------------------------------------------------------------------
// Utility functions.
//-----------------------------------------------------------------------------

/**
 * Add vertex, that coordinate is (x,y,z), to scope geometry.
 *
 * @param {THREE.Geometry} scope Geometry to add vertex.
 * @param {Number} x X coordinate
 * @param {Number} y Y coordinate
 * @param {Number} z Z coordinate
 */
Voxceler.v = function(scope, x, y, z) {
	scope.vertices.push(new THREE.Vertex(new THREE.Vector3(x, y, z)));
};

/**
 * Add face index to scope geometry.
 *
 * @param {THREE.Geometry} scope Geometry to add face index.
 * @param {Number} v1 Vertext index 1
 * @param {Number} v2 Vertext index 2
 * @param {Number} v3 Vertext index 3
 * @param {Number} v4 Vertext index 4
 */
Voxceler.f4 = function(scope, v1, v2, v3, v4) {
	scope.faces.push(new THREE.Face4(v1, v2, v3, v4));
};

/**
 * Calc degree angle to radian angle.
 *
 * @param {Number} degree Degree angle
 * @return {Number} Radian angle
 */
Voxceler.toRadian = function(degree) {
	return degree * Math.PI / 180;
};

/**
 * Convert (r,g, b) style color to hexadecimal style color.
 *
 * @param {Number} r Red color [0-255]
 * @param {Number} g Green color [0-255]
 * @param {Number} b Blue color [0-255]
 * @return {Number} Hexadecimal style color
 */
Voxceler.toHex = function(r, g, b) {
	var c = (r << 16) | (g << 8) | b;
	return c;
};

/**
 * Print log message.
 */
Voxceler.log = {
	/**
	 * Print debug log.
	 */
	debug: function() {
		if (Voxceler.isDebug) {
			console.log('[debug]', arguments);
		}
	},

	/**
	 * Print info log.
	 */
	info: function() {
		console.log(arguments);
	}
};

//-----------------------------------------------------------------------------
// Classes.
//-----------------------------------------------------------------------------

/**
 * Create vox cube specified size.
 * 
 * @class Representation of a voxcel.
 * @constructor
 * @param {Number} size Box size
 */
Voxceler.Vox = function(size) {
	THREE.Geometry.call(this);

	var s = size / 2;

	Voxceler.v(this,  s,  s, -s);
	Voxceler.v(this,  s, -s, -s);
	Voxceler.v(this, -s, -s, -s);
	Voxceler.v(this, -s,  s, -s);
	Voxceler.v(this,  s,  s,  s);
	Voxceler.v(this,  s, -s,  s);
	Voxceler.v(this, -s, -s,  s);
	Voxceler.v(this, -s,  s,  s);

	Voxceler.f4(this, 0, 1, 2, 3 );
	Voxceler.f4(this, 4, 7, 6, 5 );
	Voxceler.f4(this, 0, 4, 5, 1 );
	Voxceler.f4(this, 1, 5, 6, 2 );
	Voxceler.f4(this, 2, 6, 7, 3 );
	Voxceler.f4(this, 4, 0, 3, 7 );

	this.computeCentroids();
	this.computeFaceNormals();
};

Voxceler.Vox.prototype = new THREE.Geometry();
Voxceler.Vox.prototype.constructor = Voxceler.Vox;

//-----------------------------------------------------------------------------
// Renderer.
//-----------------------------------------------------------------------------

/**
 * Initialize renderer.
 *
 * @class Voxcel renderer.
 * @param {String} [optional] elementId Container DOM element id attribute.
 */
Voxceler.Renderer = function() {
	this.initialize.apply(this, arguments);
};

Voxceler.Renderer.prototype = {

	/**
	 * Initialize renderer.
	 *
	 * @constructor
	 * @param {String} [optional] elementId Container DOM element id attribute.
	 */
	initialize: function(config) {
		var config = config || {},
				containerId = config.containerId || 'voxceler-container',
				voxcelSize = config.voxcelSize || 32,
				width = config.width || 640,
				height = config.height || 480;

		this.width = width;
		this.height = height;
		this.voxcelSize = voxcelSize;
		this.scene = new THREE.Scene();
		this.projector = new THREE.Projector();

		this.createRenderer(containerId, width, height);
		this.initBrush(this.scene);
		//this.drawGrid(this.scene, voxcelSize);
		this.initCamera(width / height);
		this.initLights(this.scene);
		this.initIconCanvas(this.scene, voxcelSize);
		this.bindEvents(this.renderer.domElement);
	},

	/**
	 * Render scene.
	 */
	render: function() {
		this.renderer.render(this.scene, this.camera);
	},

	/**
	 * Interact mouse with objects in the scene.
	 * Check intersects between mouse and objects in current scene.
	 */
	interact: function() {
		var intersects = this.ray.intersectScene(this.scene),
				unit = Voxceler.VOXCEL_UNIT_SIZE,
				offset = Voxceler.VOXCEL_UNIT_SIZE / 2,
				intersect, pos, rotation, normal;

		if (intersects.length > 0) {
			intersect = (intersects[0].object != this.brush) ? intersects[0] : intersects[1];
			Voxceler.log.debug(intersect);
			if (intersect) {
				rotation = intersect.object.matrixRotationWorld;
				normal = intersect.face.normal.clone();
				pos = new THREE.Vector3().add(intersect.point, rotation.multiplyVector3(normal));
				Voxceler.log.debug(pos);
				this.brush.position.x = Math.floor(pos.x / unit) * unit + offset;
				this.brush.position.y = Math.floor(pos.y / unit) * unit + offset;
				this.brush.position.z = Math.floor(pos.z / unit) * unit + offset;
				Voxceler.log.debug(this.brush.position);
			}
		} else {
			this.brush.position.y = 4000;
		}
	},

	/**
	 * Create and initialize renderer.
	 */
	createRenderer: function(containerId, width, height) {
		var container, renderer;

		if (containerId && document.getElementById(containerId)) {
			container = document.getElementById(containerId);
		} else {
			container = document.createElement('div');
			container.setAttribute('id', containerId);
			document.body.appendChild(container);
		}

		if (Voxceler.hasWebGL) {
			renderer = new THREE.WebGLRenderer();
			Voxceler.log.info('Renderer using WebGL feature.');
		} else {
			renderer = new THREE.CanvasRenderer();
			Voxceler.log.info('Renderer using canvas feature.');
		}
		renderer.setSize(width, height);
		container.appendChild(renderer.domElement);

		this.renderer = renderer;
	},

	/**
	 * Initialize camera matrix.
	 *
	 * @param {Number} aspectRatio Screen aspect ratio.
	 */
	initCamera: function(aspectRatio) {
		this.radius = 3000;
		this.theta = 45;
		this.phi = 60;

		this.camera = new THREE.Camera(40, aspectRatio, 1, 10000);
		this.camera.target.position.y = 200;
		this.updateCamera();

		this.ray = new THREE.Ray(this.camera.position);
	},

	/**
	 * Update camera matrix.
	 */
	updateCamera: function() {
		var camera = this.camera,
				pos = camera.position,
				r = this.radius,
				theta = Voxceler.toRadian(this.theta / 2),
				phi = Voxceler.toRadian(this.phi / 2);

		pos.x = r * Math.sin(theta) * Math.cos(phi);
		pos.y = r * Math.sin(phi);
		pos.z = r * Math.cos(theta) * Math.cos(phi);

		camera.updateMatrix();
	},

	/**
	 * Initialize light.
	 * 
	 * @param {THREE.Scene} The scene to add light.
	 */
	initLights: function(scene) {
		var ambientLight = new THREE.AmbientLight(0x404040);
		scene.addLight(ambientLight);

		var directionalLight = new THREE.DirectionalLight(0xf0f0f0);
		directionalLight.position.x = 1;
		directionalLight.position.y = 1;
		directionalLight.position.z = 0.75;
		directionalLight.position.normalize();
		scene.addLight(directionalLight);
	},

	/**
	 * Create and init brush object.
	 * 
	 * @param {THREE.Scene} The scene to add grid.
	 */
	initBrush: function(scene) {
		var brush = this.createVoxMesh(0xdf1f1f, 0.4);
		brush.position.y = 4000; // move to unvisible area
		brush.overdraw = true;
		scene.addObject(brush);

		this.brush = brush;
	},

	/**
	 * Draw grid.
	 *
	 * @param {THREE.Scene} The scene to add grid.
	 */
	drawGrid: function(scene, voxcelSize) {
		var fieldSize = Voxceler.VOXCEL_UNIT_SIZE * voxcelSize / 2;

		var plane =
			new THREE.Mesh(
				new THREE.Plane(2 * fieldSize, 2 * fieldSize),
				new THREE.MeshBasicMaterial({
					color: 0xffffff,
					opacity: 0
				}));
		plane.rotation.x = Voxceler.toRadian(-90);
		scene.addObject(plane);

		var gridGeometry = new THREE.Geometry();
		Voxceler.v(gridGeometry, -fieldSize, 0, 0);
		Voxceler.v(gridGeometry,  fieldSize, 0, 0);

		var linesMaterial = new THREE.LineBasicMaterial({color: 0x909090, lineWidth: 0.1});

		var line1, line2;
		for (var i = 0; i <= voxcelSize; ++i) {
      line1 = new THREE.Line(gridGeometry, linesMaterial);
			line1.position.z = (i * Voxceler.VOXCEL_UNIT_SIZE) - fieldSize;
			this.scene.addObject(line1);

			line2 = new THREE.Line(gridGeometry, linesMaterial);
			line2.position.x = (i * Voxceler.VOXCEL_UNIT_SIZE) - fieldSize;
			line2.rotation.y = Voxceler.toRadian(90);
			scene.addObject(line2);
		}
	},

	/**
	 * Initiazlize image icon canvas area.
	 */
	initIconCanvas: function(scene, voxcelSize) {
		this.voxRoot = this.createVoxMesh(0xffffff, 0);
		this.voxRoot.visible = false;
		scene.addObject(this.voxRoot);

		var iconCanvas = document.createElement('canvas');
		iconCanvas.width = iconCanvas.height = voxcelSize;
		this.iconCanvas = iconCanvas;
		this.iconContext = iconCanvas.getContext('2d');
	},

	/**
	 * Unporject 2D coordinate to 3D coordinate using current camera
	 * and save it to interact ray.
	 *
	 * @param {Number} x X coordinate in 2D canvas
	 * @param {Number} y Y coordinate in 2D canvas
	 */
	unproject: function(x, y) {
		var dom = this.renderer.domElement,
				cx = x - dom.offsetLeft,
				cy = y - dom.offsetTop,
				ux = (cx / this.width) * 2 - 1,
				uy = -(cy / this.height) * 2 + 1,
				v = new THREE.Vector3(ux, uy, 0.5),
				pos = this.projector.unprojectVector(v, this.camera);

		this.ray.direction = pos.subSelf(this.camera.position).normalize();
	},

	/**
	 * Create mesh include vox and specified colored material.
	 * 
	 * @param {Number} color Vox color
	 * @param {Number} opacity Vox opacity
	 * @return {THREE.Mesh}
	 */
	createVoxMesh: function(color, opacity) {
		var material = new THREE.MeshBasicMaterial({
					color: color,
					opacity: opacity || 1.0
				}),
				vox = new Voxceler.Vox(Voxceler.VOXCEL_UNIT_SIZE),
				mesh = new THREE.Mesh(vox, material);

		return mesh;
	},

	/**
	 * Bind events to renderer.
	 * 
	 * @param {Element} rendererElement DOM element.
	 */
	bindEvents: function(rendererElement) {
		rendererElement.parent = this;

		rendererElement.addEventListener('mousedown', this.onMouseDown, false);
		rendererElement.addEventListener('mousemove', this.onMouseMove, false);
		rendererElement.addEventListener('mouseup', this.onMouseUp, false);
		rendererElement.addEventListener('mousewheel', this.onMouseWheel, false);

		if (window.FileReader) {
			rendererElement.addEventListener('dragover', this.onDragOver, false);
			rendererElement.addEventListener('drop', this.onDrop, false);
		}

		this.isMouseDown = false;
		this.onMouseDownTheta = this.theta;
		this.onMouseDownPhi = this.phi;
		this.onMouseDownPosition = new THREE.Vector2();
	},

	/**
	 * Handler for mousedown event.
	 * @param e Event object
	 */
	onMouseDown: function(e) {
		e.preventDefault();

		var renderer = e.target.parent;
		renderer.isMouseDown = true;

		renderer.onMouseDownTheta = renderer.theta;
		renderer.onMouseDownPhi = renderer.phi;
		renderer.onMouseDownPosition.x = e.clientX;
		renderer.onMouseDownPosition.y = e.clientY;

		renderer.render();
	},

	/**
	 * Handler for mousemove event.
	 * @param e Event object
	 */
	onMouseMove: function(e) {
		e.preventDefault();

		var renderer = e.target.parent;
		if (renderer.isMouseDown) {
			renderer.theta = - ((e.clientX - renderer.onMouseDownPosition.x) * 0.5) + renderer.onMouseDownTheta;
			renderer.phi = ((e.clientY - renderer.onMouseDownPosition.y) * 0.5) + renderer.onMouseDownPhi;
			renderer.phi = Math.min(180, Math.max(0, renderer.phi));
			renderer.updateCamera();
		}
		
		renderer.unproject(e.clientX, e.clientY);
		renderer.interact();
		renderer.render();
	},

	/**
	 * Handler for mouseup event.
	 * @param e Event object
	 */
	onMouseUp: function(e) {
		e.preventDefault();

		var renderer = e.target.parent;
		renderer.isMouseDown = false;

		renderer.onMouseDownPosition.x = e.clientX - renderer.onMouseDownPosition.x;
		renderer.onMouseDownPosition.y = e.clientY - renderer.onMouseDownPosition.y;

		renderer.render();
	},

	/**
	 * Handler for mousewheel event.
	 * @param e Event object
	 */
	onMouseWheel: function(e) {
		e.preventDefault();

		var renderer = e.target.parent;
		
		renderer.radius = Math.max(renderer.radius - e.wheelDeltaY, 800);
		renderer.updateCamera();
		renderer.render();
	},

	/**
	 * Handler for dragover event.
	 * @param e Event object
	 */
	onDragOver: function(e) {
		e.preventDefault();
	},

	/**
	 * Handler for drop event.
	 * @param e Event object
	 */
	onDrop: function(e) {
		e.preventDefault();

		var renderer = e.target.parent,
				file = e.dataTransfer.files[0],
				fileType = file.type,
				fileReader;

    if (!fileType.match(/image\/\w+/)){
      alert('File is not an image file.');
      return;
    }

		renderer.appendLoadingInfo();

		fileReader = new FileReader();
		fileReader.onload = function() {
			var img = new Image();
			img.onload = function() {
				renderer.processImage(img);
				img = null;
				renderer.removeLoadingInfo();
			};
			img.src = fileReader.result;
		};
		fileReader.readAsDataURL(file);
	},

	/**
	 * Append loading info element.
	 */
	appendLoadingInfo: function() {
		loadingInfo = document.createElement('div');
		loadingInfo.setAttribute('id', Voxceler.LOADING_INFO_ELEMENT_ID);
		loadingInfo.style.width = window.innerWidth + 'px';
		loadingInfo.style.height = window.innerHeight + 'px';
		loadingInfo.style.zIndex = 1000;
		loadingInfo.style.backgroundColor = '#000000';
		loadingInfo.style.opacity = 0.7;
		loadingInfo.style.position = 'absolute';
		loadingInfo.style.top = '0px';
		loadingInfo.style.left = '0px';
		loadingInfo.style.textAlign = 'center';

		loadingText = document.createElement('p');
		loadingText.style.lineHeight = loadingInfo.style.height;
		loadingText.style.color = '#fff';
		loadingText.style.fontSize = '36px';
		loadingText.innerText = 'Loading ...';
		loadingInfo.appendChild(loadingText);

		Voxceler.log.debug(loadingInfo, loadingText);

		document.body.appendChild(loadingInfo);
	},

	/**
	 * Remove loading info element.
	 */
	removeLoadingInfo: function() {
		var loadingInfo = document.getElementById(Voxceler.LOADING_INFO_ELEMENT_ID);
		if (loadingInfo) {
			document.body.removeChild(loadingInfo);
		}
	},

	/**
	 * Process image data and draw as vox.
	 *
	 * @param {Image} img Image object to load.
	 */
	processImage: function(img) {
		var imageData, pixels,
				x, y, i, offset,
				color, opacity,
				mesh, pos,
				vs = this.voxcelSize / 2,
				w = this.voxcelSize,
				h = this.voxcelSize;

		this.scene.removeChildRecurse(this.voxRoot);
		
		this.iconContext.clearRect(0, 0, w, h);
		this.iconContext.drawImage(img, 0, 0, w, h);
		imageData = this.iconContext.getImageData(0, 0, w, h);
		pixels = imageData.data;

		for (y = 0; y < h; ++y) {
			offset = y * w;
			for (x = 0; x < w; ++x) {
				i = (offset + x) * 4;
				opacity = pixels[i+3] / 255;
				if (opacity === 0) {
					continue;
				}
				color = Voxceler.toHex(pixels[i], pixels[i+1], pixels[i+2]);
				mesh = this.createVoxMesh(color, opacity);
				pos = mesh.position;
				pos.x = (x - vs) * Voxceler.VOXCEL_UNIT_SIZE;
				pos.y = (h -  y - vs) * Voxceler.VOXCEL_UNIT_SIZE;
				this.voxRoot.addChild(mesh);
			}
		}

		this.render();
	}
	
};