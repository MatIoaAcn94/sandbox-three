"use client"

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react"
import { Loader2, MonitorCog } from "lucide-react"

/** Info about an extracted scene node (mesh) */
export interface SceneNode {
  id: string
  name: string
  materialName: string
  originalColor: string
}

/** Light configuration the parent can control */
export interface LightConfig {
  ambientColor: string
  ambientIntensity: number
  directionalColor: string
  directionalIntensity: number
}

/** Set di texture PBR da poter sostituire dinamicamente */
export interface TextureSet {
  baseColorMap?: string;
  normalMap?: string;
  ormMap?: string;
}

export interface ViewerHandle {
  setNodeColor: (nodeId: string, color: string) => void
  resetNodeColor: (nodeId: string) => void
  highlightNode: (nodeId: string | null) => void
  updateLights: (config: LightConfig) => void
  setModelVisibility: (modelSuffix: string, prefix: string) => void
  setLogoVisibility: (modelSuffix: string, logoType: string, logoPosition: string, prefix: string) => void
  setNodeTextures: (nodeId: string, textures: TextureSet) => Promise<void>
}

// Passiamo anche l'elenco di tutti i nomi dei nodi al genitore
export interface SceneMetadata {
  nodes: SceneNode[];
  allNodeNames: string[];
}

interface ViewerProps {
  modelUrl: string | null
  fileMap: Map<string, string> | null
  onSceneReady: (metadata: SceneMetadata) => void
}

function LoadingOverlay() {
  return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 z-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-sans">
          Caricamento scena 3D...
        </p>
      </div>
  )
}

function EmptyState() {
  return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
        <div className="flex flex-col items-center gap-2 opacity-50">
          <MonitorCog className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-sans">
            Carica un modello GLTF/GLB per iniziare
          </p>
        </div>
      </div>
  )
}

type MeshRecord = {
  mesh: any
  originalColor: string
  originalEmissive: string
}

const Viewer3D = forwardRef<ViewerHandle, ViewerProps>(function Viewer3D(
    { modelUrl, fileMap, onSceneReady },
    ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const stateRef = useRef<{
    renderer: any
    scene: any
    camera: any
    controls: any
    frame: number
    placeholderMesh: any
    currentModel: any
    disposed: boolean
    ambientLight: any
    directionalLight: any
    meshMap: Map<string, MeshRecord>
    highlightedId: string | null
  }>({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    frame: 0,
    placeholderMesh: null,
    currentModel: null,
    disposed: false,
    ambientLight: null,
    directionalLight: null,
    meshMap: new Map(),
    highlightedId: null,
  })

  const [rendererType, setRendererType] = useState<"webgpu" | "webgl" | "loading">("loading")
  const [ready, setReady] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)

  useImperativeHandle(
      ref,
      () => ({
        setNodeColor(nodeId: string, color: string) {
          const record = stateRef.current.meshMap.get(nodeId)
          if (!record) return
          record.mesh.material.color.set(color)
        },
        resetNodeColor(nodeId: string) {
          const record = stateRef.current.meshMap.get(nodeId)
          if (!record) return
          record.mesh.material.color.set(record.originalColor)
        },
        highlightNode(nodeId: string | null) {
          const state = stateRef.current
          if (state.highlightedId) {
            const prev = state.meshMap.get(state.highlightedId)
            if (prev && prev.mesh.material.emissive) {
              prev.mesh.material.emissive.set(prev.originalEmissive)
            }
          }
          state.highlightedId = nodeId
          if (nodeId) {
            const record = state.meshMap.get(nodeId)
            if (record && record.mesh.material.emissive) {
              record.mesh.material.emissive.set("#222244")
            }
          }
        },
        updateLights(config: LightConfig) {
          const state = stateRef.current
          if (state.ambientLight) {
            state.ambientLight.color.set(config.ambientColor)
            state.ambientLight.intensity = config.ambientIntensity
          }
          if (state.directionalLight) {
            state.directionalLight.color.set(config.directionalColor)
            state.directionalLight.intensity = config.directionalIntensity
          }
        },
        // Nasconde/Mostra i modelli basandosi su un prefisso passato dal genitore
        setModelVisibility(modelSuffix: string, prefix: string) {
          const state = stateRef.current
          if (!state.currentModel) return

          state.currentModel.traverse((node: any) => {
            if (node.name && node.name.startsWith(prefix)) {
              node.visible = node.name.endsWith(modelSuffix)
            }
          })
        },
        // Gestisce la visibilità dinamica dei loghi
        setLogoVisibility(modelSuffix: string, logoType: string, logoPosition: string, prefix: string) {
          const state = stateRef.current
          if (!state.currentModel) return

          const targetLogoName = `${prefix}${logoType}_${logoPosition}_grp_${modelSuffix}`

          state.currentModel.traverse((node: any) => {
            if (
                node.name &&
                node.name.startsWith(prefix) &&
                node.name.includes(`_grp_${modelSuffix}`)
            ) {
              node.visible = (node.name === targetLogoName)
            }
          })
        },
        async setNodeTextures(nodeId: string, textures: TextureSet) {
          const state = stateRef.current
          const record = state.meshMap.get(nodeId)
          if (!record || !record.mesh.material) return

          const THREE = await import("three")
          const textureLoader = new THREE.TextureLoader()
          const material = record.mesh.material

          if (textures.baseColorMap) {
            const map = await textureLoader.loadAsync(textures.baseColorMap)
            map.flipY = false
            map.colorSpace = THREE.SRGBColorSpace
            material.map = map
          }

          if (textures.normalMap) {
            const normalMap = await textureLoader.loadAsync(textures.normalMap)
            normalMap.flipY = false
            material.normalMap = normalMap
          }

          if (textures.ormMap) {
            const ormMap = await textureLoader.loadAsync(textures.ormMap)
            ormMap.flipY = false
            material.aoMap = ormMap
            material.roughnessMap = ormMap
            material.metalnessMap = ormMap
          }

          material.needsUpdate = true
        }
      }),
      []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const state = stateRef.current
    state.disposed = false
    let resizeObserver: ResizeObserver | null = null

    async function init() {
      const THREE = await import("three")

      if (state.disposed) return

      const width = container!.clientWidth
      const height = container!.clientHeight

      const scene = new THREE.Scene()
      scene.background = new THREE.Color("#1a1a2e")
      scene.fog = new THREE.Fog("#1a1a2e", 15, 30)
      state.scene = scene

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
      camera.position.set(4, 3, 6)
      camera.lookAt(0, 0, 0)
      state.camera = camera

      let renderer: any = null
      let isWebGPU = false

      if (typeof navigator !== "undefined" && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter()
          if (adapter && !state.disposed) {
            const WebGPUModule = await import("three/webgpu")
            renderer = new WebGPUModule.WebGPURenderer({
              canvas: canvas!,
              antialias: true,
            })
            await renderer.init()
            isWebGPU = true
          }
        } catch { renderer = null }
      }

      if (!renderer && !state.disposed) {
        renderer = new THREE.WebGLRenderer({
          canvas: canvas!,
          antialias: true,
          alpha: true,
        })
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.2
      }

      if (state.disposed || !renderer) return

      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      state.renderer = renderer

      setRendererType(isWebGPU ? "webgpu" : "webgl")

      const ambient = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambient)
      state.ambientLight = ambient

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
      dirLight.position.set(5, 8, 5)
      dirLight.castShadow = true
      scene.add(dirLight)
      state.directionalLight = dirLight

      const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
      dirLight2.position.set(-3, 4, -5)
      scene.add(dirLight2)

      const grid = new THREE.GridHelper(20, 40, 0x333344, 0x222233)
      grid.position.y = -0.01
      scene.add(grid)

      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js")
      if (state.disposed) return

      const controls = new OrbitControls(camera, canvas!)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.minDistance = 1
      controls.maxDistance = 20
      controls.maxPolarAngle = Math.PI / 2 - 0.05
      state.controls = controls

      const torusGeo = new THREE.TorusKnotGeometry(1, 0.35, 128, 32)
      const torusMat = new THREE.MeshStandardMaterial({
        color: 0x4a7dff,
        roughness: 0.3,
        metalness: 0.7,
      })
      const placeholder = new THREE.Mesh(torusGeo, torusMat)
      scene.add(placeholder)
      state.placeholderMesh = placeholder

      function animate() {
        if (state.disposed) return
        state.frame = requestAnimationFrame(animate)
        if (state.placeholderMesh) {
          state.placeholderMesh.rotation.y += 0.005
        }
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const handleResize = () => {
        if (state.disposed || !container) return
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(container)

      setReady(true)
    }

    init()

    return () => {
      state.disposed = true
      if (resizeObserver) resizeObserver.disconnect()
      cancelAnimationFrame(state.frame)
      state.controls?.dispose()
      state.renderer?.dispose()
      state.renderer = null
      state.scene = null
      state.camera = null
      state.controls = null
      state.placeholderMesh = null
      state.currentModel = null
      state.meshMap.clear()
    }
  }, [])

  const loadModel = useCallback(async () => {
    const state = stateRef.current
    if (!modelUrl || !state.scene) return

    setModelLoading(true)

    try {
      const THREE = await import("three")
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
      const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js")

      const manager = new THREE.LoadingManager()

      if (fileMap && fileMap.size > 0) {
        manager.setURLModifier((url: string) => {
          const fileName = url.split("/").pop()?.split("?")[0] || ""
          if (fileMap.has(url)) return fileMap.get(url)!
          if (fileMap.has(fileName)) return fileMap.get(fileName)!
          const decoded = decodeURIComponent(fileName)
          if (fileMap.has(decoded)) return fileMap.get(decoded)!
          return url
        })
      }

      const loader = new GLTFLoader(manager)
      const dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/")
      loader.setDRACOLoader(dracoLoader)

      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject)
      })

      if (state.placeholderMesh) {
        state.scene.remove(state.placeholderMesh)
        state.placeholderMesh.geometry?.dispose()
        state.placeholderMesh.material?.dispose()
        state.placeholderMesh = null
      }

      if (state.currentModel) {
        state.scene.remove(state.currentModel)
        state.currentModel.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose()
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((m: any) => m.dispose())
          }
        })
      }
      state.meshMap.clear()

      const model = gltf.scene

      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 3 / maxDim
      model.scale.setScalar(scale)
      model.position.x = -center.x * scale
      model.position.y = -box.min.y * scale
      model.position.z = -center.z * scale

      const sceneNodes: SceneNode[] = []
      const allNodeNames: string[] = []
      let meshIndex = 0

      model.traverse((child: any) => {
        if (child.name) allNodeNames.push(child.name) // Salviamo i nomi per l'analisi dinamica

        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true

          if (child.material) {
            child.material = child.material.clone()
          }

          const id = `mesh_${meshIndex++}`
          const mat = child.material
          const colorHex = mat.color ? "#" + mat.color.getHexString() : "#ffffff"
          const emissiveHex = mat.emissive ? "#" + mat.emissive.getHexString() : "#000000"

          state.meshMap.set(id, {
            mesh: child,
            originalColor: colorHex,
            originalEmissive: emissiveHex,
          })

          sceneNodes.push({
            id,
            name: child.name || `Mesh ${meshIndex}`,
            materialName: mat.name || `Material_${meshIndex}`,
            originalColor: colorHex,
          })
        }
      })

      state.scene.add(model)
      state.currentModel = model

      // Passiamo anche l'array di tutti i nomi per poterli estrarre in page.tsx
      onSceneReady({ nodes: sceneNodes, allNodeNames })

      if (state.controls) {
        state.controls.target.set(0, (size.y * scale) / 2, 0)
        state.controls.update()
      }
    } catch (err) {
      console.error("[v0] Error loading GLTF model:", err)
    } finally {
      setModelLoading(false)
    }
  }, [modelUrl, fileMap, onSceneReady])

  useEffect(() => {
    if (ready && modelUrl) {
      loadModel()
    }
  }, [ready, modelUrl, loadModel])

  return (
      <div ref={containerRef} className="relative h-full w-full bg-background">
        <canvas ref={canvasRef} className="h-full w-full block" />

        {!ready && <LoadingOverlay />}

        {modelLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <div className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-foreground font-sans">
              Caricamento modello...
            </span>
              </div>
            </div>
        )}

        {/* Renderer Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
          <div
              className={`h-2 w-2 rounded-full ${
                  rendererType === "webgpu"
                      ? "bg-emerald-400"
                      : rendererType === "webgl"
                          ? "bg-amber-400"
                          : "bg-muted-foreground animate-pulse"
              }`}
          />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {rendererType === "loading" ? "Detecting..." : rendererType}
        </span>
        </div>

        {!modelUrl && ready && !modelLoading && <EmptyState />}
      </div>
  )
})

export default Viewer3D