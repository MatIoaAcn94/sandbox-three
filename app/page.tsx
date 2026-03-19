"use client"

import { useState, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import ConfigSidebar from "@/components/configurator/config-sidebar"
import type { SceneNode, ViewerHandle, LightConfig } from "@/components/configurator/viewer-3d"

const Viewer3D = dynamic(() => import("@/components/configurator/viewer-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground font-sans">
          Inizializzazione renderer...
        </p>
      </div>
    </div>
  ),
})

const DEFAULT_LIGHTS: LightConfig = {
  ambientColor: "#ffffff",
  ambientIntensity: 0.6,
  directionalColor: "#ffffff",
  directionalIntensity: 1.2,
}

export default function ConfiguratorPage() {
  const viewerRef = useRef<ViewerHandle>(null)
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [fileMap, setFileMap] = useState<Map<string, string> | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [sceneNodes, setSceneNodes] = useState<SceneNode[]>([])
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null)
  const [lightConfig, setLightConfig] = useState<LightConfig>(DEFAULT_LIGHTS)

  const handleModelLoad = useCallback(
    (url: string, name: string, map: Map<string, string>) => {
      if (fileMap) {
        fileMap.forEach((blobUrl) => URL.revokeObjectURL(blobUrl))
      }
      setModelUrl(url)
      setFileName(name)
      setFileMap(map)
      setSceneNodes([])
      setSelectedGroupName(null)
      setLightConfig(DEFAULT_LIGHTS)
    },
    [fileMap]
  )

  const handleSceneReady = useCallback((nodes: SceneNode[]) => {
    setSceneNodes(nodes)
  }, [])

  const handleSelectGroup = useCallback(
    (name: string | null) => {
      setSelectedGroupName(name)
      // Highlight all nodes in the group (first one for the camera focus)
      if (name) {
        const firstNode = sceneNodes.find((n) => n.materialName === name)
        viewerRef.current?.highlightNode(firstNode?.id ?? null)
      } else {
        viewerRef.current?.highlightNode(null)
      }
    },
    [sceneNodes]
  )

  const handleChangeGroupColor = useCallback(
    (nodeIds: string[], color: string) => {
      for (const id of nodeIds) {
        viewerRef.current?.setNodeColor(id, color)
      }
    },
    []
  )

  const handleResetGroupColor = useCallback(
    (nodeIds: string[]) => {
      for (const id of nodeIds) {
        viewerRef.current?.resetNodeColor(id)
      }
    },
    []
  )

  const handleLightChange = useCallback(
    (config: LightConfig) => {
      setLightConfig(config)
      viewerRef.current?.updateLights(config)
    },
    []
  )

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 3D Viewport */}
      <div className="relative flex-1 min-w-0">
        <Viewer3D
          ref={viewerRef}
          modelUrl={modelUrl}
          fileMap={fileMap}
          onSceneReady={handleSceneReady}
        />
      </div>

      {/* Configuration Sidebar */}
      <aside className="w-[320px] shrink-0 border-l border-border overflow-hidden">
        <ConfigSidebar
          onModelLoad={handleModelLoad}
          currentFileName={fileName}
          sceneNodes={sceneNodes}
          selectedGroupName={selectedGroupName}
          onSelectGroup={handleSelectGroup}
          onChangeGroupColor={handleChangeGroupColor}
          onResetGroupColor={handleResetGroupColor}
          lightConfig={lightConfig}
          onLightChange={handleLightChange}
        />
      </aside>
    </main>
  )
}
