
import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth"
import {
  getConfig,
  saveConfig,
  clearConfig,
  getSelectedStates,
  testConnection,
  getStates,
  toggleEntity,
  turnOn,
  turnOff,
  setLightBrightness,
  setLightColor,
  setLightColorTemp,
  callService,
} from "@/lib/home-assistant/service"

// GET /api/home-assistant
// ?action=status    - connection status + selected entity states
// ?action=config    - get stored config (tokens stripped)
// ?action=entities  - list all supported entities (for picker)
// ?action=test      - test connection with provided url+token
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action") ?? "status"

    if (action === "status") {
      const result = await getSelectedStates(userId)
      return NextResponse.json(result)
    }

    if (action === "config") {
      const { baseUrl, selectedEntities } = await getConfig(userId)
      return NextResponse.json({
        connected: !!baseUrl,
        baseUrl: baseUrl ?? null,
        selectedEntities,
      })
    }

    if (action === "entities") {
      const { baseUrl, accessToken } = await getConfig(userId)
      if (!baseUrl || !accessToken) {
        return NextResponse.json({ entities: [] })
      }
      const entities = await getStates(baseUrl, accessToken)
      return NextResponse.json({
        entities: entities.map((e) => ({
          entity_id: e.entity_id,
          state: e.state,
          friendly_name: e.attributes.friendly_name ?? e.entity_id,
          domain: e.entity_id.split(".")[0],
        })),
      })
    }

    if (action === "test") {
      const url = searchParams.get("url")
      const token = searchParams.get("token")
      if (!url || !token) {
        return NextResponse.json({ error: "Missing url or token" }, { status: 400 })
      }
      const info = await testConnection(url.replace(/\/+$/, ""), token)
      return NextResponse.json({ success: true, ...info })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/home-assistant - call a service (toggle, brightness, color, etc.)
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    const { baseUrl, accessToken } = await getConfig(userId)
    if (!baseUrl || !accessToken) {
      return NextResponse.json({ error: "Not connected" }, { status: 400 })
    }

    const body = await request.json() as {
      action: string
      entity_id: string
      brightness?: number
      rgb_color?: [number, number, number]
      color_temp_kelvin?: number
      domain?: string
      service?: string
      service_data?: Record<string, unknown>
    }

    const { action, entity_id } = body
    let success = false

    switch (action) {
      case "toggle":
        success = await toggleEntity(baseUrl, accessToken, entity_id)
        break
      case "turn_on":
        success = await turnOn(baseUrl, accessToken, entity_id)
        break
      case "turn_off":
        success = await turnOff(baseUrl, accessToken, entity_id)
        break
      case "brightness":
        success = await setLightBrightness(baseUrl, accessToken, entity_id, body.brightness ?? 100)
        break
      case "color":
        if (body.rgb_color) {
          success = await setLightColor(baseUrl, accessToken, entity_id, body.rgb_color)
        }
        break
      case "color_temp":
        if (body.color_temp_kelvin) {
          success = await setLightColorTemp(baseUrl, accessToken, entity_id, body.color_temp_kelvin)
        }
        break
      case "call_service":
        if (body.domain && body.service) {
          success = await callService(
            baseUrl,
            accessToken,
            body.domain,
            body.service,
            { entity_id, ...body.service_data },
          )
        }
        break
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    return NextResponse.json({ success })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/home-assistant - save config (url, token, selected entities)
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    const body = await request.json() as {
      baseUrl?: string
      accessToken?: string
      selectedEntities?: string[]
    }

    await saveConfig(body, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/home-assistant - disconnect (clear all config)
export async function DELETE() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    await clearConfig(userId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
  }
}
