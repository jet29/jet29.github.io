let controls, scene, camera, renderer;

function init(){

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setClearColor( 0xffffff );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild( renderer.domElement );

    scene = new THREE.Scene();
    window.scene = scene;
    //scene.background = new THREE.Color( 0xffffff );
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.z = 5;
    

    controls = new THREE.OrbitControls( camera, renderer.domElement );
}

function addLights(){

    const light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );


    const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
    directionalLight.position.set(1,1,1);
    scene.add( directionalLight );
}

function addSky(){
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
    'https://threejsfundamentals.org/threejs/resources/images/equirectangularmaps/tears_of_steel_bridge_2k.jpg',
    () => {
    const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
    rt.fromEquirectangularTexture(renderer, texture);
    scene.background = rt.texture;
    });
}

function addModels(){
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial( { color: 0x00ff00 } );
    const cube = new THREE.Mesh( geometry, material );
    cube.position.set(5,0,0);
    scene.add( cube );
}

function animate() {
	requestAnimationFrame( animate );
    
	// required if controls.enableDamping or controls.autoRotate are set to true
	controls.update();

	renderer.render( scene, camera );
}

init();
addSky();
addLights();
addModels();
animate();
