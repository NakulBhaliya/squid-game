const loadingScreen = document.getElementById('loading-screen');
const instructionPage = document.getElementById('instruction-page');
const startButton = document.getElementById('start-button');
const replayButton = document.getElementById('replay-button');

// Initially hide game elements
document.getElementById('hearts-container').style.display = 'none';
document.getElementById('replay-button').style.display = 'none';

// Loading screen handler
window.addEventListener('load', () => {
    // Show loading screen for 2 seconds
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            instructionPage.classList.remove('hidden');
        }, 500); // Wait for fade out animation
    }, 2000);
});

// Start button click handler
startButton.addEventListener('click', () => {
    instructionPage.classList.add('hidden');
    document.getElementById('hearts-container').style.display = 'block';
});

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
    replayButton.style.display = 'block';
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
    if (!isGameOver) {
        isFalling = true;
        playFallSound();
        // Delay glass sound by 0.1 seconds
        setTimeout(() => {
            playGlassSound();
        }, 100);
        slowMotionEffect();

        // Add physics to both character and glass
        const physics = {
            object: characterObj,
            velocity: 0,
            bounceCount: 0,
            maxBounces: 1,
            bounceFactor: 0.3,
            isResting: false
        };

        const glassPhysics = {
            object: plane,
            velocity: 0,
            bounceCount: 0,
            maxBounces: 1,
            bounceFactor: 0.3,
            isResting: false,
            isGlass: true
        };

        // Make glass semi-transparent
        if (plane.material) {
            plane.material.transparent = true;
            plane.material.opacity = 0.7;
        }

        // Add both to falling objects
        fallingObjects.push(physics);
        fallingObjects.push(glassPhysics);

        // Stop any current animations
        if (jumpAction) jumpAction.stop();

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
                replayButton.onclick = () => window.location.reload();
            } else {
                replayButton.textContent = 'Try Again';
                replayButton.onclick = () => {
                    resetCharacter();
                    camera.position.copy(originalCameraPos);
                    controls.target.set(0, 0.5, 0);
                    character.rotation.set(0, 0, 0);
                    fallingObjects = [];
                    isFalling = false;
                    if (idleAction) {
                        idleAction.reset();
                        idleAction.play();
                    }
                };
            }
            // replayButton.classList.add('visible');
            replayButton.style.display = 'block';

            showFallAnimation(hearts);
        }, 2000);
    }
}

function resetCharacter() {
    if (!character) return;
    
    character.position.set(0, 1.3, 1.35);
    character.rotation.set(0, 0, 0);
    
    isJumping = false;
    isFalling = false;
    currentPairIndex = 0;
    
    // replayButton.classList.remove('visible');
    replayButton.style.display = 'none';

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

// Sound Effects
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
camera.add(listener);

// Create sound objects
const jumpSound = new THREE.Audio(listener);
const fallSound = new THREE.Audio(listener);
const glassSound = new THREE.Audio(listener);
const winSound = new THREE.Audio(listener);

// Load sound files
audioLoader.load('./sounds/jump_pop.mp3', function(buffer) {
    jumpSound.setBuffer(buffer);
    jumpSound.setVolume(0.5);
});

audioLoader.load('./sounds/fall_scream.mp3', function(buffer) {
    fallSound.setBuffer(buffer);
    fallSound.setVolume(0.4);
});

audioLoader.load('./sounds/glass_shatter.mp3', function(buffer) {
    glassSound.setBuffer(buffer);
    glassSound.setVolume(0.6);
});

audioLoader.load('./sounds/win_fanfare.mp3', function(buffer) {
    winSound.setBuffer(buffer);
    winSound.setVolume(0.7);
});

// Function to play sounds
function playJumpSound() {
    if (!jumpSound.isPlaying) {
        jumpSound.play();
    }
}

function playFallSound() {
    if (!fallSound.isPlaying) {
        fallSound.play();
    }
}

function playGlassSound() {
    if (!glassSound.isPlaying) {
        glassSound.play();
    }
}

function playWinSound() {
    if (!winSound.isPlaying) {
        winSound.play();
    }
}

let timeScale = 1;

function slowMotionEffect(duration = 1000) {
    timeScale = 0.2; // Slow down to 20% speed
    setTimeout(() => {
        timeScale = 1; // Return to normal speed
    }, duration);
}

window.addEventListener('resize', () =>
{
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

const planeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.02)
const textureLoader = new THREE.TextureLoader()
const noiseTexture = textureLoader.load('./textures/noise.png')
noiseTexture.wrapS = THREE.RepeatWrapping
noiseTexture.wrapT = THREE.RepeatWrapping

const planeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    roughness: 0.8,
    transmission: 0.4,
    thickness: 0.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.8,
    ior: 1.5,
    metalness: 0,
    roughnessMap: noiseTexture,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide
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
        plane.position.set(x, 1.185, z);
        
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
            
            // Delay jump sound by 0.5 seconds
            setTimeout(() => {
                playJumpSound();
            }, 500);

            if (jumpAction) {
                jumpAction.reset();
                jumpAction.clampWhenFinished = true;
                jumpAction.play();
            }

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
                        if (currentPairIndex === 7) {
                            playWinSound();
                        }
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
    const deltaTime = clock.getDelta() * timeScale;

    controls.update()

    // Update mixer
    if(characterMixer) {
        characterMixer.update(deltaTime)
    }

    // Update physics
    if(character && character.position && !isGameOver) {
        fallingObjects.forEach((obj, index) => {
            if (!obj.isResting) {
                // Apply same gravity to both character and glass
                obj.velocity += gravity * deltaTime * (isFalling ? 0.4 : 1);
                obj.object.position.y -= obj.velocity * deltaTime;

                if (obj.isGlass) {
                    // Just fade glass
                    if (obj.object.material && obj.object.material.opacity > 0.3) {
                        obj.object.material.opacity -= deltaTime * 0.1;
                    }
                } else if (obj.object === character) {
                    // Rotate character
                    if (character.rotation.x < Math.PI / 2) {
                        character.rotation.x += deltaTime * 1.5;
                    }
                    
                    // Update camera to follow character
                    camera.position.x = character.position.x + 1.2;
                    camera.position.y = character.position.y + 0.4;
                    camera.position.z = character.position.z + 0.5;
                    controls.target.copy(character.position);
                }

                // Handle floor collision
                if (obj.object.position.y <= floorY) {
                    obj.object.position.y = floorY;
                    
                    if (obj.bounceCount < obj.maxBounces) {
                        // Apply bounce with reduced effect for glass
                        const bounceFactor = obj.isGlass ? obj.bounceFactor * 0.5 : obj.bounceFactor;
                        obj.velocity = -obj.velocity * bounceFactor;
                        obj.bounceCount++;
                        
                        if (obj.object === character) {
                            camera.position.y += 0.05;
                        }
                    } else {
                        obj.isResting = true;
                        if (obj.object === character) {
                            character.rotation.x = Math.PI / 2;
                        }
                        if (obj.isGlass) {
                            // Keep glass visible on floor
                            obj.object.position.y = floorY + 0.01;
                        }
                    }
                }
            }
        });
    }

    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()