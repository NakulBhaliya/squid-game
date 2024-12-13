import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Base
 */
// Debug
const gui = new GUI()

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Models
 */
const gltfLoader = new GLTFLoader()

let mixer = null
let characterMixer = null
let character = null
let idleAction = null
let jumpAction = null
let isJumping = false
let currentPairIndex = 0
let hasClickedInCurrentPair = false
let weakPlanes = new Set()
let isFalling = false

// Function to randomly select weak planes (one from each pair)
function selectWeakPlanes() {
    for(let i = 0; i < 15; i++) {
        const pairStart = i * 2 + 1;
        const weakPlane = Math.random() < 0.5 ? pairStart : pairStart + 1;
        weakPlanes.add(weakPlane);
    }
    console.log('Weak planes:', Array.from(weakPlanes));
}

// Load main game model
gltfLoader.load(
    './models/squidgamecomp2.glb',
    (gltf) =>
    {
        gltf.scene.scale.set(1, 1, 1)
        gltf.scene.position.set(0, 0, 0)
        gltf.scene.rotation.set(0, 0, 0)
        scene.add(gltf.scene)

        // Animation
        mixer = new THREE.AnimationMixer(gltf.scene)
        const action = mixer.clipAction(gltf.animations[2])
        action.play()
    }
)

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

// Call this after creating all planes
selectWeakPlanes();

let gravity = 9.81;
let fallingObjects = [];
let floorY = 0.18; // Match the floor plane's Y position

function addToPhysics(object) {
    fallingObjects.push({
        object: object,
        velocity: 0,
        isResting: false,
        startRotation: object.rotation.clone(),
        rotationSpeed: {
            x: (Math.random() - 0.5) * 5,
            y: (Math.random() - 0.5) * 5,
            z: (Math.random() - 0.5) * 5
        },
        bounceOffset: Math.random() * 0.5 // Random bounce timing offset
    });
}

function startFalling(plane, characterObj) {
    isFalling = true;
    addToPhysics(plane);
    addToPhysics(characterObj);
}

/**
 * Floor
 */
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

// Create invisible physics floor
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

/**
 * Lights
 */
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

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
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

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 1.8, 1.9)
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.5, 0)
controls.enableDamping = true

// Update plane creation with frosted glass material
const planeGeometry = new THREE.PlaneGeometry(0.5, 0.5)
const planeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    roughness: 0.5,    // Increased for frosted look
    metalness: 0.1,
    transmission: 0.6,  // Reduced for more frosting
    thickness: 0.5,
    clearcoat: 0.1,    // Slight clearcoat for shine
    clearcoatRoughness: 0.4,  // Rough clearcoat for frosted effect
    side: THREE.DoubleSide,
    envMapIntensity: 0.5  // Subtle environment reflections
})

// Add some noise to the material for frosted texture
const textureLoader = new THREE.TextureLoader()
const noiseTexture = textureLoader.load('./textures/noise.png', (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4)
    planeMaterial.roughnessMap = texture
    planeMaterial.transmissionMap = texture
    planeMaterial.needsUpdate = true
})

// Create planes
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
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    raycaster.setFromCamera(mouse, camera)

    const intersects = raycaster.intersectObjects(planes)

    if (intersects.length > 0 && !isJumping && !isFalling && character && idleAction && jumpAction) {
        const clickedPlane = intersects[0].object;
        const planeNumber = parseInt(clickedPlane.name.replace('plane', ''));
        
        const validPairStart = currentPairIndex * 2 + 1;
        const validPairEnd = validPairStart + 1;
        
        if (planeNumber >= validPairStart && planeNumber <= validPairEnd) {
            isJumping = true;

            if (!hasClickedInCurrentPair) {
                currentPairIndex++;
                hasClickedInCurrentPair = true;
                console.log(`Unlocked planes ${currentPairIndex * 2 + 1} and ${currentPairIndex * 2 + 2}`);
            }

            idleAction.stop()
            jumpAction.setLoop(THREE.LoopOnce)
            jumpAction.reset()
            jumpAction.play()

            const targetX = clickedPlane.position.x
            const targetZ = clickedPlane.position.z
            const startX = character.position.x
            const startZ = character.position.z
            const startY = 1.3
            const targetY = 1.258
            const duration = 1.0
            const startTime = Date.now()

            function animateMove() {
                const elapsedTime = (Date.now() - startTime) / 1000
                const progress = Math.min(elapsedTime / duration, 1)

                character.position.x = startX + (targetX - startX) * progress
                character.position.z = startZ + (targetZ - startZ) * progress
                character.position.y = startY + (targetY - startY) * progress

                if (progress < 1) {
                    requestAnimationFrame(animateMove)
                } else {
                    character.position.x = targetX
                    character.position.z = targetZ
                    character.position.y = targetY
                    
                    if (weakPlanes.has(planeNumber)) {
                        startFalling(clickedPlane, character);
                    } else {
                        jumpAction.stop()
                        idleAction.play()
                        isJumping = false
                        hasClickedInCurrentPair = false
                    }
                }
            }

            animateMove()

            jumpAction.addEventListener('finished', () => {
                jumpAction.stop()
                idleAction.play()
                isJumping = false
            })
        } else {
            console.log(`Can only click planes ${validPairStart} or ${validPairEnd} now`)
        }
    }
})

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = Date.now()

const tick = () =>
{
    const currentTime = Date.now()
    const deltaTime = (currentTime - previousTime) / 1000
    previousTime = currentTime

    // Update physics for falling objects
    fallingObjects.forEach((obj) => {
        if (!obj.isResting) {
            // Apply gravity
            obj.velocity += gravity * deltaTime;
            
            // Update position
            const newY = obj.object.position.y - obj.velocity * deltaTime;
            
            // Check for floor collision
            if (newY <= floorY) {
                obj.object.position.y = floorY;
                obj.isResting = true;
                obj.velocity = 0;
                
                if (obj.object !== character) {
                    // Plane settles flat
                    obj.object.rotation.x = Math.PI / 2;
                    obj.object.rotation.y = 0;
                    obj.object.rotation.z = 0;
                    
                    // Small random offset for plane
                    const scatter = 0.2;
                    obj.object.position.x += (Math.random() - 0.5) * scatter;
                    obj.object.position.z += (Math.random() - 0.5) * scatter;
                } else {
                    // Character settles in a dramatic fallen pose
                    obj.object.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
                    obj.object.rotation.y = Math.random() * Math.PI * 2;
                    obj.object.rotation.z = (Math.random() - 0.5) * 0.8;
                    
                    // Scatter character further from plane
                    const characterScatter = 0.5;
                    obj.object.position.x += (Math.random() - 0.5) * characterScatter;
                    obj.object.position.z += (Math.random() - 0.5) * characterScatter;
                }
            } else {
                obj.object.position.y = newY;
                
                // Different rotation behaviors while falling
                if (obj.object === character) {
                    // More dramatic tumbling for character
                    obj.object.rotation.x += obj.rotationSpeed.x * deltaTime * 1.5;
                    obj.object.rotation.y += obj.rotationSpeed.y * deltaTime * 1.5;
                    obj.object.rotation.z += obj.rotationSpeed.z * deltaTime * 1.5;
                } else {
                    // Simpler rotation for plane
                    obj.object.rotation.x += deltaTime * 2;
                    obj.object.rotation.z += deltaTime;
                }
            }
        }
    });

    // Update character mixer
    if(characterMixer)
    {
        characterMixer.update(deltaTime)
    }

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()