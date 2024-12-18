import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 1.8, 1.9)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.5, 0)
controls.enableDamping = true

/**
 * Models
 */
const gltfLoader = new GLTFLoader()

let character = null;
let characterMixer = null;
let idleAction = null;
let jumpAction = null;
let isJumping = false;
let isFalling = false;
let currentPairIndex = 0;
let hearts = 3;
let isGameOver = false;
let weakPlanes = new Set();
let replayButton = document.getElementById('replay-button');
let heartsContainer = document.getElementById('hearts-container');

const gameOverlay = document.createElement('div');
gameOverlay.className = 'game-overlay';
document.body.appendChild(gameOverlay);

const overlayContent = document.createElement('div');
overlayContent.className = 'game-overlay-content';
gameOverlay.appendChild(overlayContent);

const heartsDisplay = document.createElement('div');
heartsDisplay.className = 'hearts-display';
overlayContent.appendChild(heartsDisplay);

function updateHearts() {
    heartsContainer.innerHTML = Array(hearts)
        .fill(`<span class="heart-icon">💛</span>`)
        .join('');
}

function showGameOver() {
    gameOverlay.style.display = 'flex';
    
    // Create game over text as a button
    const gameOverText = document.createElement('button');
    gameOverText.textContent = 'GAME OVER';
    gameOverText.style.color = '#ff0000';
    gameOverText.style.fontSize = '64px';
    gameOverText.style.fontFamily = 'Arial, sans-serif';
    gameOverText.style.textShadow = '0 0 20px #ff0000';
    gameOverText.style.opacity = '0';
    gameOverText.style.transition = 'opacity 1s ease-in';
    gameOverText.style.background = 'none';
    gameOverText.style.border = 'none';
    gameOverText.style.cursor = 'pointer';
    gameOverText.onclick = () => window.location.reload();
    gameOverText.onmouseover = () => {
        gameOverText.style.transform = 'scale(1.1)';
        gameOverText.style.textShadow = '0 0 30px #ff0000';
    };
    gameOverText.onmouseout = () => {
        gameOverText.style.transform = 'scale(1)';
        gameOverText.style.textShadow = '0 0 20px #ff0000';
    };
    overlayContent.appendChild(gameOverText);
    
    heartsDisplay.innerHTML = Array(3)
        .fill(`<span class="heart-icon">💛</span>`)
        .join('');
    
    const heartIcons = heartsDisplay.querySelectorAll('.heart-icon');
    let currentHeart = 2; // Start with the last heart
    
    const blinkInterval = setInterval(() => {
        if (currentHeart >= 0) {
            heartIcons[currentHeart].classList.add('blink');
            currentHeart--;
            
            // After last heart disappears, show game over text
            if (currentHeart < 0) {
                setTimeout(() => {
                    gameOverText.style.opacity = '1';
                    replayButton.classList.add('visible');
                }, 1000);
            }
        } else {
            clearInterval(blinkInterval);
        }
    }, 1000);
}

function showHeartLossAnimation(remainingHearts) {
    // Create and show the heart loss animation
    const heartLoss = document.createElement('div');
    heartLoss.className = 'heart-lost';
    heartLoss.textContent = '💛';
    document.body.appendChild(heartLoss);
    
    // Remove the element after animation completes
    heartLoss.addEventListener('animationend', () => {
        document.body.removeChild(heartLoss);
    });
    
    // Animate the specific heart in the hearts container
    const heartIcons = heartsContainer.querySelectorAll('.heart-icon');
    if (heartIcons[remainingHearts]) {
        heartIcons[remainingHearts].classList.add('blink');
    }
}

function showFallAnimation(currentHearts) {
    // Remove any existing fall-hearts container
    const existingHearts = document.querySelector('.fall-hearts');
    if (existingHearts) {
        document.body.removeChild(existingHearts);
    }

    // Create hearts container above the replay button
    const fallHearts = document.createElement('div');
    fallHearts.className = 'fall-hearts';
    document.body.appendChild(fallHearts);
    
    // Add only the remaining hearts (currentHearts + 1 because we're about to lose one)
    for(let i = 0; i < currentHearts + 1; i++) {
        const heart = document.createElement('span');
        heart.className = 'fall-heart';
        heart.textContent = '💛';
        // Make the last heart disappear
        if (i === currentHearts) {
            heart.classList.add('disappear');
        }
        fallHearts.appendChild(heart);
    }
    
    // Add click handler to replay button to remove hearts
    const removeHearts = () => {
        const hearts = document.querySelector('.fall-hearts');
        if (hearts) {
            document.body.removeChild(hearts);
        }
        replayButton.removeEventListener('click', removeHearts);
    };
    replayButton.addEventListener('click', removeHearts);
}

function startFalling(plane, characterObj) {
    if (!characterObj || isGameOver) return;
    
    isFalling = true;
    
    // Stop any current animations
    if (jumpAction) jumpAction.stop();
    if (idleAction) idleAction.stop();
    
    addToPhysics(plane);
    const physics = {
        object: characterObj,
        velocity: 0,
        bounceCount: 0,
        maxBounces: 1, // Reduced bounces
        bounceFactor: 0.3, // Reduced bounce height
        isResting: false
    };
    fallingObjects.push(physics);

    // Move camera to side view during fall
    const originalCameraPos = camera.position.clone();
    camera.position.set(
        characterObj.position.x + 1.2,
        characterObj.position.y + 0.4,
        characterObj.position.z + 0.5
    );
    controls.target.copy(characterObj.position);

    setTimeout(() => {
        hearts--;
        updateHearts();
        
        if (hearts <= 0) {
            isGameOver = true;
            showGameOver();
            replayButton.textContent = 'Start Again';
            replayButton.onclick = () => {
                const hearts = document.querySelector('.fall-hearts');
                if (hearts) {
                    document.body.removeChild(hearts);
                }
                window.location.reload();
            };
        } else {
            replayButton.textContent = 'Try Again';
            replayButton.onclick = () => {
                const hearts = document.querySelector('.fall-hearts');
                if (hearts) {
                    document.body.removeChild(hearts);
                }
                resetCharacter();
                // Reset camera and character
                camera.position.copy(originalCameraPos);
                controls.target.set(0, 0.5, 0);
                character.rotation.set(0, 0, 0);
                fallingObjects = [];
                isFalling = false;
                // Restart idle animation
                if (idleAction) {
                    idleAction.reset();
                    idleAction.play();
                }
            };
        }
        replayButton.classList.add('visible');
        showFallAnimation(hearts);
    }, 2000);
}

function resetCharacter() {
    if (!character) return;
    
    character.position.set(0, 1.3, 1.35);
    character.rotation.set(0, 0, 0);
    
    isJumping = false;
    isFalling = false;
    currentPairIndex = 0;
    
    replayButton.classList.remove('visible');
}

function selectWeakPlanes() {
    for(let i = 0; i < 15; i++) {
        const pairStart = i * 2;
        const weakPlane = Math.random() < 0.5 ? `plane${pairStart + 1}` : `plane${pairStart + 2}`;
        weakPlanes.add(weakPlane);
    }
}

// Select weak planes at start
selectWeakPlanes();

// Load character model
gltfLoader.load(
    './models/player.glb',
    (gltf) =>
    {
        character = gltf.scene
        character.scale.set(0.15, 0.15, 0.15)
        character.position.set(0, 1.3, 1.35)
        character.rotation.set(0, 0, 0)
        scene.add(character)

        // Set up character animations
        characterMixer = new THREE.AnimationMixer(character)
        
        // Check if animations exist and log them
        console.log('Available animations:', gltf.animations)
        
        if (gltf.animations && gltf.animations.length > 0) {
            // Get animations
            idleAction = characterMixer.clipAction(gltf.animations[0]) // First animation (idle)
            
            if (gltf.animations.length > 1) {
                jumpAction = characterMixer.clipAction(gltf.animations[1]) // Second animation (jump)
            }
            
            // Set up idle animation to loop
            if (idleAction) {
                idleAction.play()
            }
        } else {
            console.warn('No animations found in the model')
        }
    }
)

// Load main game model
gltfLoader.load(
    './models/squidgamecomp2.glb',
    (gltf) =>
    {
        gltf.scene.scale.set(1, 1, 1)
        gltf.scene.position.set(0, 0, 0)
        gltf.scene.rotation.set(0, 0, 0)
        scene.add(gltf.scene)
    }
)

let gravity = 9.81;
let fallingObjects = [];
let floorY = 0.18;

function addToPhysics(object) {
    const physics = {
        object: object,
        velocity: 0,
        isResting: false,
        bounceOffset: object === character ? 0.1 : 0,
        startRotation: {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z
        }
    };
    fallingObjects.push(physics);
}

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({
        color: '#444444',
        metalness: 0,
        roughness: 0.5
    })
)
floor.receiveShadow = true
floor.rotation.x = - Math.PI * 0.5
floor.position.set(0, 0, 0)
scene.add(floor)

const physicsFloorGeometry = new THREE.PlaneGeometry(10, 10)
const physicsFloorMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
})
const physicsFloor = new THREE.Mesh(physicsFloorGeometry, physicsFloorMaterial)
physicsFloor.rotation.x = -Math.PI * 0.5
physicsFloor.position.y = 0.18
scene.add(physicsFloor)

const ambientLight = new THREE.AmbientLight(0xffffff, 2.4)
ambientLight.position.set(0, 0, 0)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
directionalLight.position.set(0, 0, 0)
scene.add(directionalLight)

window.addEventListener('resize', () =>
{
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

const planeGeometry = new THREE.PlaneGeometry(0.5, 0.5)
const planeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    roughness: 0.5,
    metalness: 0.1,
    transmission: 0.6,
    thickness: 0.5,
    clearcoat: 0.1,
    clearcoatRoughness: 0.4,
    side: THREE.DoubleSide,
    envMapIntensity: 0.5
})

const textureLoader = new THREE.TextureLoader()
const noiseTexture = textureLoader.load('./textures/noise.png', (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4)
    planeMaterial.roughnessMap = texture
    planeMaterial.transmissionMap = texture
    planeMaterial.needsUpdate = true
})

const planes = [];
const startX = -0.12;
const startZ = 1.11;
const xSpacing = 0.23;
const zSpacing = 0.21;

for(let row = 0; row < 15; row++) {
    for(let col = 0; col < 2; col++) {
        const plane = new THREE.Mesh(planeGeometry, planeMaterial.clone())
        plane.rotation.x = -Math.PI * 0.5
        plane.scale.set(0.31, 0.31, 0.3);
        
        const x = startX + (col * xSpacing);
        const z = startZ - (row * zSpacing);
        plane.position.set(x, 1.19, z);
        
        const planeNumber = row * 2 + col + 1;
        plane.name = `plane${planeNumber}`;
        
        scene.add(plane);
        planes.push(plane);
    }
}

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planes);

    if (intersects.length > 0 && !isJumping && !isFalling && character && idleAction && jumpAction) {
        const clickedPlane = intersects[0].object;
        const planeNumber = parseInt(clickedPlane.name.replace('plane', ''));
        const validPairStart = currentPairIndex * 2 + 1;
        const validPairEnd = validPairStart + 1;
        
        if (planeNumber >= validPairStart && planeNumber <= validPairEnd) {
            isJumping = true;
            
            // Start jump animation
            idleAction.stop();
            jumpAction.reset();
            jumpAction.setLoop(THREE.LoopOnce);
            jumpAction.clampWhenFinished = true;
            jumpAction.play();

            const targetX = clickedPlane.position.x;
            const targetZ = clickedPlane.position.z;
            const startX = character.position.x;
            const startZ = character.position.z;
            const duration = 0.5;
            const startTime = Date.now();

            function animateMove() {
                const elapsedTime = (Date.now() - startTime) / 1000;
                const progress = Math.min(elapsedTime / duration, 1);

                character.position.x = startX + (targetX - startX) * progress;
                character.position.z = startZ + (targetZ - startZ) * progress;
                character.position.y = 1.258 + Math.sin(progress * Math.PI) * 0.08;

                if (progress < 1) {
                    requestAnimationFrame(animateMove);
                } else {
                    character.position.x = targetX;
                    character.position.z = targetZ;
                    character.position.y = 1.258;

                    // Stop jump animation and return to idle
                    jumpAction.stop();
                    idleAction.reset();
                    idleAction.play();
                    isJumping = false;

                    if (weakPlanes.has(clickedPlane.name)) {
                        startFalling(clickedPlane, character);
                    } else {
                        currentPairIndex++;
                    }
                }
            }
            
            animateMove();
        } else {
            console.log(`Can only click planes ${validPairStart} or ${validPairEnd} now`);
        }
    }
});

replayButton.addEventListener('click', () => {
    gameOverlay.style.display = 'none';
    if (hearts <= 0) {
        hearts = 3;
        updateHearts();
        isGameOver = false;
        currentPairIndex = 0;
        fallingObjects = [];
    } else {
        currentPairIndex = Math.max(0, Math.floor((character.position.z - startZ) / zSpacing));
    }
    resetCharacter();
});

const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const clock = new THREE.Clock()
let previousTime = Date.now()

const tick = () =>
{
    const currentTime = Date.now()
    // Adjusted slow motion to 0.35
    const deltaTime = isFalling ? (currentTime - previousTime) / 1000 * 0.35 : (currentTime - previousTime) / 1000;
    previousTime = currentTime

    controls.update()

    // Update character animations only if not falling
    if (characterMixer && !isFalling) {
        characterMixer.update(deltaTime)
    }

    // Update physics and camera
    fallingObjects.forEach(obj => {
        if (!obj.isResting) {
            obj.velocity += gravity * deltaTime * (isFalling ? 0.4 : 1);
            obj.object.position.y -= obj.velocity * deltaTime;

            // Rotate character during fall
            if (obj.object === character) {
                // Rotate forward to lay down
                if (character.rotation.x < Math.PI / 2) {
                    character.rotation.x += deltaTime * 1.5;
                }
            }

            // Update camera position to follow character
            if (obj.object === character && isFalling) {
                camera.position.x = character.position.x + 1.2;
                camera.position.y = character.position.y + 0.4;
                camera.position.z = character.position.z + 0.5;
                controls.target.copy(character.position);
            }

            if (obj.object.position.y <= floorY) {
                obj.object.position.y = floorY;
                
                if (obj.bounceCount < obj.maxBounces) {
                    // Smaller bounce
                    obj.velocity = -obj.velocity * obj.bounceFactor;
                    obj.bounceCount++;
                    
                    // Smaller camera bump
                    if (obj.object === character) {
                        camera.position.y += 0.05;
                    }
                } else {
                    obj.isResting = true;
                    // Make sure character stays laying down
                    if (obj.object === character) {
                        character.rotation.x = Math.PI / 2;
                    }
                }
            }
        }
    });

    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()