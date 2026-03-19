"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import ModelUploader from "./model-uploader"
import { Paintbrush, Layers, Sun, Box, RotateCcw } from "lucide-react"
import type { SceneNode, LightConfig } from "./viewer-3d"

/** A group of nodes sharing the same materialName */
interface NodeGroup {
  materialName: string
  nodeIds: string[]
  originalColor: string
  count: number
}

interface ConfigSidebarProps {
  onModelLoad: (url: string, fileName: string, fileMap: Map<string, string>) => void
  currentFileName: string | null
  sceneNodes: SceneNode[]
  selectedGroupName: string | null
  onSelectGroup: (name: string | null) => void
  onChangeGroupColor: (nodeIds: string[], color: string) => void
  onResetGroupColor: (nodeIds: string[]) => void
  lightConfig: LightConfig
  onLightChange: (config: LightConfig) => void
}

function buildGroups(nodes: SceneNode[]): NodeGroup[] {
  const map = new Map<string, NodeGroup>()
  for (const node of nodes) {
    const key = node.materialName
    const existing = map.get(key)
    if (existing) {
      existing.nodeIds.push(node.id)
      existing.count++
    } else {
      map.set(key, {
        materialName: key,
        nodeIds: [node.id],
        originalColor: node.originalColor,
        count: 1,
      })
    }
  }
  return Array.from(map.values())
}

export default function ConfigSidebar({
  onModelLoad,
  currentFileName,
  sceneNodes,
  selectedGroupName,
  onSelectGroup,
  onChangeGroupColor,
  onResetGroupColor,
  lightConfig,
  onLightChange,
}: ConfigSidebarProps) {
  const groups = buildGroups(sceneNodes)
  const selectedGroup = groups.find((g) => g.materialName === selectedGroupName) || null
  const uniqueGroupCount = groups.length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Box className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            Configuratore 3D
          </h1>
          <p className="text-[10px] text-muted-foreground">
            Carica e personalizza il tuo modello
          </p>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col gap-1 p-4">
          {/* Upload Section */}
          <div className="mb-2">
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Modello
            </label>
            <ModelUploader onModelLoad={onModelLoad} currentFileName={currentFileName} />
          </div>

          <Separator className="my-3" />

          <Accordion
            type="multiple"
            defaultValue={["components", "lights"]}
            className="w-full"
          >
            {/* Components / Meshes Section */}
            <AccordionItem value="components" className="border-b-0">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Componenti</span>
                  {uniqueGroupCount > 0 && (
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {uniqueGroupCount}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                {sceneNodes.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Nessun componente disponibile.
                    <br />
                    Carica un modello per iniziare.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {groups.map((group) => {
                      const isSelected = selectedGroupName === group.materialName
                      return (
                        <button
                          key={group.materialName}
                          onClick={() =>
                            onSelectGroup(isSelected ? null : group.materialName)
                          }
                          className={`group flex items-center gap-3 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-accent"
                          }`}
                        >
                          {/* Color swatch */}
                          <div
                            className="h-3.5 w-3.5 shrink-0 rounded border border-border"
                            style={{ backgroundColor: group.originalColor }}
                          />
                          <span className="truncate font-medium flex-1">
                            {group.materialName}
                          </span>
                          {group.count > 1 && (
                            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {group.count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Color editor for selected group */}
                {selectedGroup && (
                  <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paintbrush className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[11px] font-medium text-foreground truncate max-w-[160px]">
                          {selectedGroup.materialName}
                        </span>
                        {selectedGroup.count > 1 && (
                          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {selectedGroup.count} oggetti
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onResetGroupColor(selectedGroup.nodeIds)}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title="Ripristina colore originale"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </button>
                    </div>
                    <Label className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      Colore
                    </Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        defaultValue={selectedGroup.originalColor}
                        key={selectedGroup.materialName + "-color"}
                        onChange={(e) =>
                          onChangeGroupColor(selectedGroup.nodeIds, e.target.value)
                        }
                        className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        defaultValue={selectedGroup.originalColor}
                        key={selectedGroup.materialName + "-hex"}
                        onBlur={(e) => {
                          const val = e.target.value
                          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                            onChangeGroupColor(selectedGroup.nodeIds, val)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = (e.target as HTMLInputElement).value
                            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                              onChangeGroupColor(selectedGroup.nodeIds, val)
                            }
                          }
                        }}
                        className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Lights Section */}
            <AccordionItem value="lights" className="border-b-0">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Luci</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="flex flex-col gap-5">
                  {/* Ambient Light */}
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="mb-3 text-[11px] font-medium text-foreground">
                      Luce Ambientale
                    </p>

                    <div className="mb-3 flex flex-col gap-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Colore
                      </Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={lightConfig.ambientColor}
                          onChange={(e) =>
                            onLightChange({
                              ...lightConfig,
                              ambientColor: e.target.value,
                            })
                          }
                          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {lightConfig.ambientColor}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Intensita
                        </Label>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {lightConfig.ambientIntensity.toFixed(1)}
                        </span>
                      </div>
                      <Slider
                        value={[lightConfig.ambientIntensity]}
                        onValueChange={([val]) =>
                          onLightChange({
                            ...lightConfig,
                            ambientIntensity: val,
                          })
                        }
                        min={0}
                        max={3}
                        step={0.1}
                      />
                    </div>
                  </div>

                  {/* Directional Light */}
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="mb-3 text-[11px] font-medium text-foreground">
                      Luce Direzionale
                    </p>

                    <div className="mb-3 flex flex-col gap-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Colore
                      </Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={lightConfig.directionalColor}
                          onChange={(e) =>
                            onLightChange({
                              ...lightConfig,
                              directionalColor: e.target.value,
                            })
                          }
                          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {lightConfig.directionalColor}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Intensita
                        </Label>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {lightConfig.directionalIntensity.toFixed(1)}
                        </span>
                      </div>
                      <Slider
                        value={[lightConfig.directionalIntensity]}
                        onValueChange={([val]) =>
                          onLightChange({
                            ...lightConfig,
                            directionalIntensity: val,
                          })
                        }
                        min={0}
                        max={5}
                        step={0.1}
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="px-5 py-3">
        <p className="text-[10px] text-muted-foreground text-center">
          WebGPU Configurator v0.1
        </p>
      </div>
    </div>
  )
}
