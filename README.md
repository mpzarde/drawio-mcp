# Draw.io MCP Server

A Model Context Protocol (MCP) server that provides programmatic tools for creating and managing draw.io diagrams using mxgraph. Generate architecture diagrams, flowcharts, and other visualizations through a clean API that works with Claude Desktop and other MCP-compatible clients.

## Overview

This server enables you to build diagrams incrementally by providing stateless tools that operate on `.drawio` files. Each operation specifies the target file, generating standard draw.io XML format compatible with VSCode's draw.io extension, draw.io web, and desktop applications.

### Key Features

- **Stateless API**: Each tool call specifies the target file path
- **Universal Compatibility**: Generates standard `.drawio` XML files that work with VSCode, draw.io web, and desktop applications
- **Multi-Tab Support**: Work with multiple tabs/pages within a single diagram file
- **Custom Data Properties**: Store arbitrary metadata on nodes for advanced workflows
- **Advanced Search**: Find nodes by ID, title, kind, position, or custom data properties
- **Cross-File Copying**: Copy nodes between files and tabs with full property preservation
- **Rich Node Types**: Support for rectangles, ellipses, cylinders, clouds, actors, and more
- **Connection Management**: Create labeled connections with various styling options
- **Batch Operations**: Create, update, and link multiple nodes in a single MCP call for efficient diagram building
- **Flexible Positioning**: Precise control over node placement and sizing
- **MCP Integration**: Works with Claude Desktop and other MCP-compatible applications
- **TypeScript**: Full type safety and IntelliSense support

## Demo

![Demo](presentation.gif)

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn

## Configuration

### MCP Client Setup

Add this configuration to your MCP client (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "drawio-diagrams": {
      "command": "npx",
      "args": ["drawio-mcp"]
    }
  }
}
```

### File Paths

The server supports both absolute and relative file paths:

- **Absolute**: `/Users/username/project/diagrams/architecture.drawio`
- **Relative**: `./diagrams/architecture.drawio` (when cwd is configured)

All diagram files should use the `.drawio` extension for compatibility with draw.io tools.

### Multi-Tab Support

All tools support working with specific tabs (pages) within a diagram file:

- **Default behavior**: Operates on the first tab if not specified (backward compatible)
- **By name**: `"tab": "Architecture"` - work with a specific named tab
- **By index**: `"tab": 0` - work with tab by zero-based index
- **Creating tabs**: Specify a new tab name when saving to create it
- **Preservation**: Modifying one tab doesn't affect others

**Example:**
```json
{
  "file_path": "./diagrams/system.drawio",
  "tab": "Architecture",
  "nodes": [...]
}
```

### Custom Data Properties

Nodes can store arbitrary custom metadata as key-value pairs:

```json
{
  "id": "server1",
  "title": "Production Server",
  "data": {
    "environment": "production",
    "region": "us-east-1",
    "owner": "platform-team",
    "cost_center": "engineering"
  }
}
```

Use cases:
- **Classification**: Tag nodes by environment, team, priority
- **Integration**: Store external IDs for linking with other systems
- **Automation**: Add metadata for scripts and tooling
- **Search**: Find nodes using `find_nodes` with data filters

Custom data is preserved during copy operations and survives file edits.

## Tools Reference

### Batch Operations

All primary tools support batch operations, allowing you to perform multiple actions in a single MCP call for improved efficiency:

- **`add_nodes`**: Create multiple nodes simultaneously
- **`edit_nodes`**: Update multiple nodes/edges simultaneously  
- **`link_nodes`**: Create multiple connections simultaneously
- **`remove_nodes`**: Remove multiple nodes simultaneously

This approach reduces network overhead and provides atomic operations - either all changes succeed or none are applied.

---

### new_diagram

Create a new empty diagram file.

**Parameters:**
- `file_path` (string, required): Path for the new diagram file
- `tab` (string, optional): Initial tab name (defaults to "Page-1")

**Example:**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "tab": "Architecture"
}
```

### add_nodes

Add one or more nodes to an existing diagram in a single operation. Optionally run an automatic layout after insertion.

**Parameters:**
- `file_path` (string, required): Path to the diagram file
- `tab` (string | number, optional): Tab name or index to modify (defaults to first tab)
- `layout` (object, optional): Automatic layout configuration
  - `algorithm` (string, required if `layout` is provided): One of `hierarchical`, `circle`, `organic`, `compact-tree`, `radial-tree`, `partition`, `stack`
  - `options` (object, optional): Algorithm-specific options
    - For `hierarchical` only: `direction` ∈ `"top-down" | "left-right"` (default: `"top-down"`)
- `nodes` (array, required): Array of node objects to add, each containing:
  - `id` (string, required): Unique identifier for the node
  - `title` (string, required): Display label (supports newlines with `\n`)
  - `x` (number, required): X coordinate position
  - `y` (number, required): Y coordinate position
  - `kind` (string, required): Node shape type
  - `parent` (string, optional): Parent node ID (default: "root")
  - `width` (number, optional): Custom width
  - `height` (number, optional): Custom height
  - `corner_radius` (integer, optional): Corner radius in pixels (≥ 1). Only applies to `RoundedRectangle`. Default is 12 when `kind` is `RoundedRectangle` and `corner_radius` is omitted. The effective visual radius is capped by draw.io/mxGraph to at most half of the shorter side of the node.
  - `data` (object, optional): Custom metadata properties (key-value pairs)

**Available Node Types:**
- `Rectangle`: Standard rectangular node
- `Ellipse`: Oval-shaped node  
- `Cylinder`: Database/storage representation
- `Cloud`: Cloud service representation
- `Square`: Square with fixed aspect ratio
- `Circle`: Circular node
- `Step`: Process step shape
- `Actor`: UML actor (stick figure)
- `Text`: Text-only node
- `RoundedRectangle`: Rectangle with rounded corners (supports `corner_radius` in pixels)

**Example (Single Node):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "nodes": [
    {
      "id": "user-service",
      "title": "User Service\nAPI Layer",
      "kind": "Rectangle",
      "x": 100,
      "y": 150,
      "width": 120,
      "height": 80
    }
  ]
}
```

**Example (Multiple Nodes):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "nodes": [
    {
      "id": "user-service",
      "title": "User Service",
      "kind": "Rectangle",
      "x": 100,
      "y": 150
    },
    {
      "id": "database",
      "title": "Primary DB",
      "kind": "Cylinder", 
      "x": 300,
      "y": 150
    },
    {
      "id": "cache",
      "title": "Redis Cache",
      "kind": "Cylinder",
      "x": 200,
      "y": 300
    }
  ]
}
```

**Example (With Layout):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "layout": {
    "algorithm": "hierarchical",
    "options": { "direction": "left-right" }
  },
  "nodes": [
    { "id": "api", "title": "API", "kind": "Rectangle", "x": 40, "y": 40 },
    { "id": "service", "title": "Service", "kind": "Rectangle", "x": 200, "y": 40 },
    { "id": "db", "title": "DB", "kind": "Cylinder", "x": 360, "y": 40 }
  ]
}
```

Note: The layout runs once after all insertions and considers existing edges in the diagram file. For best results when edges are created or modified later, a dedicated `layout_diagram` tool is recommended (to be added).

### link_nodes

Create one or more connections between existing nodes in a single operation.

**Parameters:**
- `file_path` (string, required): Path to the diagram file
- `tab` (string | number, optional): Tab name or index to modify (defaults to first tab)
- `edges` (array, required): Array of edge objects to create, each containing:
  - `from` (string, required): Source node ID
  - `to` (string, required): Target node ID
  - `title` (string, optional): Connection label
  - `dashed` (boolean, optional): Whether to use dashed line style
  - `reverse` (boolean, optional): Whether to reverse arrow direction
  - `undirected` (boolean, optional): Create an undirected edge (no arrows). Overrides `reverse`.

**Example (Single Connection):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "edges": [
    {
      "from": "user-service",
      "to": "database",
      "title": "queries",
      "dashed": true
    }
  ]
}
```

**Example (Multiple Connections):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "edges": [
    {
      "from": "user-service",
      "to": "database",
      "title": "queries"
    },
    {
      "from": "user-service", 
      "to": "cache",
      "title": "cache lookup",
      "dashed": true
    },
    {
      "from": "database",
      "to": "cache", 
      "title": "invalidate",
      "reverse": true
    }
  ]
}
```

**Example (Undirected Connection):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "edges": [
    {
      "from": "service-a",
      "to": "service-b",
      "title": "peering",
      "undirected": true
    }
  ]
}
```

Notes on undirected behavior:
- When `undirected` is true, the edge is rendered without arrowheads (no arrow at either end). The `reverse` parameter is ignored; `dashed` is still respected.
- Undirected edges use a canonical ID format of `${min(from,to)}-2-${max(from,to)}` when a new edge is created.
- If an edge between the two nodes already exists (in either direction or with the canonical ID), calling `link_nodes` again will update that existing edge’s label and style rather than creating a duplicate. The existing edge ID is preserved (no renaming).

### edit_nodes

Modify properties of one or more existing nodes or edges in a single operation.

**Parameters:**
- `file_path` (string, required): Path to the diagram file
- `tab` (string | number, optional): Tab name or index to modify (defaults to first tab)
- `nodes` (array, required): Array of node/edge objects to update, each containing:
  - `id` (string, required): Node or edge ID to update
  - `title` (string, optional): New display label
  - `kind` (string, optional): New shape type (nodes only)
  - `x` (number, optional): New X coordinate (nodes only)
  - `y` (number, optional): New Y coordinate (nodes only)
  - `width` (number, optional): New width (nodes only)
  - `height` (number, optional): New height (nodes only)
  - `corner_radius` (integer, optional): Corner radius in pixels (≥ 1). Applies when the node is `RoundedRectangle`. If switching kind to `RoundedRectangle` and omitted, default 12 is applied. Ignored for other kinds.
  - `data` (object, optional): Custom data properties to update/merge (key-value pairs)

**Example (Single Node):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "nodes": [
    {
      "id": "user-service",
      "title": "Updated User Service",
      "x": 200,
      "y": 100
    }
  ]
}
```

**Example (Multiple Nodes):**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "nodes": [
    {
      "id": "user-service",
      "title": "Auth Service",
      "kind": "Rectangle",
      "x": 200,
      "y": 100
    },
    {
      "id": "database",
      "title": "Updated Database",
      "x": 400,
      "y": 200
    },
    {
      "id": "connection-1",
      "title": "secure connection"
    }
  ]
}
```

### remove_nodes

Remove one or more nodes from a diagram.

**Parameters:**
- `file_path` (string, required): Path to the diagram file
- `tab` (string | number, optional): Tab name or index to modify (defaults to first tab)
- `ids` (array, required): Array of node IDs to remove

**Example:**
```json
{
  "file_path": "./diagrams/system-architecture.drawio",
  "ids": ["old-service", "deprecated-db"]
}
```

### get_diagram_info

Retrieve information about a diagram including nodes and connections.

**Parameters:**
- `file_path` (string, required): Path to the diagram file
- `tab` (string | number, optional): Tab name or index to inspect (defaults to first tab)

**Example:**
```json
{
  "file_path": "./diagrams/system-architecture.drawio"
}
```

---

### find_nodes

Search for nodes in a diagram file using various filter criteria. Search can be performed across all tabs or within a specific tab.

**Parameters:**
- `file_path` (string, required): Path to the diagram file
- `tab` (string | number, optional): Tab name or index to search in (searches all tabs if omitted)
- `filters` (object, optional): Search criteria
  - `id` (string): Exact ID match
  - `id_contains` (string): Partial ID match (case-sensitive)
  - `title` (string): Exact title match
  - `title_contains` (string): Partial title match (case-insensitive)
  - `kind` (string): Node shape type (Rectangle, Ellipse, etc.)
  - `x_min`, `x_max` (number): X coordinate range
  - `y_min`, `y_max` (number): Y coordinate range
  - `data` (object): Custom data properties to match (key-value pairs)

**Example (Search by title and data):**
```json
{
  "file_path": "./diagrams/infrastructure.drawio",
  "tab": "Production",
  "filters": {
    "title_contains": "Server",
    "data": {
      "environment": "production",
      "region": "us-east-1"
    }
  }
}
```

**Returns:**
```json
{
  "results": [
    {
      "id": "server1",
      "title": "Web Server",
      "kind": "Rectangle",
      "x": 100,
      "y": 50,
      "width": 120,
      "height": 60,
      "tab": "Production",
      "data": {
        "environment": "production",
        "region": "us-east-1"
      }
    }
  ]
}
```

---

### list_tabs

List all tabs/pages in a diagram file with their statistics.

**Parameters:**
- `file_path` (string, required): Path to the diagram file

**Example:**
```json
{
  "file_path": "./diagrams/system.drawio"
}
```

**Returns:**
```json
{
  "file": "./diagrams/system.drawio",
  "tabs": [
    {
      "name": "Architecture",
      "index": 0,
      "id": "diagram-123456",
      "nodeCount": 15,
      "edgeCount": 8
    },
    {
      "name": "Data Flow",
      "index": 1,
      "id": "diagram-123457",
      "nodeCount": 23,
      "edgeCount": 12
    }
  ]
}
```

---

### copy_nodes

Copy nodes from one diagram file/tab to another, with full property preservation including custom data. Supports ID remapping, position offsetting, and optional edge copying.

**Parameters:**
- `source_file` (string, required): Path to source diagram file
- `source_tab` (string | number, optional): Source tab name or index (defaults to first tab)
- `node_ids` (array of strings, required): Array of node IDs to copy
- `target_file` (string, required): Path to target diagram file
- `target_tab` (string | number, optional): Target tab name or index (defaults to first tab, creates if doesn't exist)
- `offset_x` (number, optional): X offset to apply to copied nodes (default: 0)
- `offset_y` (number, optional): Y offset to apply to copied nodes (default: 0)
- `id_prefix` (string, optional): Prefix to add to copied node IDs (e.g., "copy_")
- `id_mapping` (object, optional): Explicit ID mapping (e.g., `{"old_id": "new_id"}`)
- `copy_connected_edges` (boolean, optional): Whether to copy edges between copied nodes (default: false)

**Example (Cross-file copy with prefix):**
```json
{
  "source_file": "./diagrams/templates.drawio",
  "source_tab": "Components",
  "node_ids": ["server1", "database1", "cache1"],
  "target_file": "./diagrams/production.drawio",
  "target_tab": "Infrastructure",
  "offset_x": 200,
  "offset_y": 50,
  "id_prefix": "prod_",
  "copy_connected_edges": true
}
```

**Features:**
- **Full property preservation**: Copies position, size, kind, title, and custom data
- **ID conflict resolution**: Use prefix or explicit mapping to avoid ID collisions
- **Position control**: Apply offsets to place copied nodes at desired locations
- **Edge handling**: Optionally copy connections between copied nodes
- **Cross-file/tab**: Copy between any combination of files and tabs

---

## Output Format

Diagrams are saved as standard `.drawio` XML files:

- **Standard XML Format**: Uncompressed, human-readable XML structure
- **Draw.io Compatible**: Works with draw.io web, desktop, and VSCode extension
- **Version Control Friendly**: Plain text format perfect for git diffs
- **Self-contained**: Complete diagram data in a single XML file

## Development

### Project Structure

```
src/
├── Graph.ts              # Core graph data structure
├── GraphFileManager.ts   # File I/O operations  
├── Logger.ts            # Logging utilities
├── index.ts             # MCP server entry point
├── mcp/                 # MCP tool implementations
│   ├── McpServer.ts     # Server framework
│   ├── NewDiagramTool.ts
│   ├── AddNodeTool.ts   # Supports batch operations (add_nodes)
│   ├── LinkNodesTools.ts # Supports batch operations (link_nodes)
│   ├── EditNodeTool.ts  # Supports batch operations (edit_nodes)
│   ├── RemoveNodesTool.ts # Supports batch operations (remove_nodes)
│   └── GetDiagramInfoTool.ts
└── mxgraph/             # mxgraph integration
    ├── index.ts
    └── jsdom.ts
```

### Building From Source

```bash
# Install dependencies
npm install

# Run TypeScript compilation
npm run build

# Start development server
npm start

# Run linting
npm run lint
```

## Support

- Create an issue on GitHub for bugs and feature requests
- Check existing issues before creating new ones
- Provide detailed reproduction steps for bug reports
