# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides programmatic tools for creating and managing draw.io diagrams using mxgraph. It generates standard `.drawio` XML files compatible with VSCode, draw.io web, and desktop applications.

## Commands

### Build and Development
```bash
# Install dependencies
npm install

# Run development server (uses tsx for TypeScript execution)
npm start

# Build for production (TypeScript compilation)
npm run build

# The build outputs to ./dist directory
```

### Package Usage
The package is designed to be run via npx as an MCP server:
```bash
npx drawio-mcp
```

### Linting
There is no linter configured yet. The project has no `npm run lint` command or linting setup.

### Testing
There is no test suite. The project has no test files or test framework configured.

## Architecture

### Core Design Principles

1. **Stateless API**: Each tool call specifies the target file path. There is no server-side session state.
2. **XML-based Persistence**: All diagrams are stored as standard draw.io XML files with multiple tab/page support.
3. **MCP Tool Pattern**: Each diagram operation is implemented as an independent MCP tool.

### Key Components

#### Graph.ts - Core Graph Data Structure
The `Graph` class is the heart of the system, wrapping mxGraph functionality:

- **Node Management**: `addNode()`, `editNode()`, `removeNodes()`, `getNodeInfo()`, `getAllNodes()`, `findNodes()`
- **Edge Management**: `linkNodes()` creates connections between nodes, supporting directed, reverse, and undirected edges
- **Layout Engine**: `applyLayout()` supports 7 algorithms: hierarchical, circle, organic, compact-tree, radial-tree, partition, stack
- **Serialization**: `toXML()` exports to mxGraph XML format, `Graph.fromXML()` imports from XML
- **Node Types**: Defined in `Graph.Kinds` - Rectangle, Ellipse, Cylinder, Cloud, Square, Circle, Step, Actor, Text, RoundedRectangle

Key implementation details:
- Custom data properties are stored as stringified JSON in `cell.data`
- Edge IDs follow patterns: `${from}-2-${to}` (directed) or `${min(from,to)}-2-${max(from,to)}` (undirected canonical)
- RoundedRectangle corner radius is stored as `arcSize` (diameter) in style properties with `absoluteArcSize=1`
- Existing edges are updated in-place rather than creating duplicates

#### GraphFileManager.ts - File I/O Layer
Handles all file system operations and multi-tab management:

- **Tab Support**: `loadGraph(filePath, tab?)` and `saveGraph(graph, filePath, tab?)` work with specific tabs by name or index
- **Multi-Diagram Files**: `parseDiagrams()` extracts all `<diagram>` elements from .drawio XML
- **Tab Listing**: `listTabs()` enumerates all tabs with node/edge counts
- **Path Resolution**: All paths are resolved relative to `process.cwd()` using `path.resolve()`

Key implementation details:
- When saving, if file exists, only the specified tab is modified; other tabs are preserved
- Tab selection: undefined = first tab, number = index, string = name
- Each diagram has an ID (`diagram-${timestamp}`) and user-visible name

#### mcp/ Directory - Tool Implementations
Each tool follows the same pattern:
1. Implements `Tool` interface with `schema()` and `execute()` methods
2. Schema defines the MCP tool contract (name, description, input schema)
3. Execute loads graph, performs operations, saves graph

Tool files:
- `NewDiagramTool.ts` - Creates empty diagram files
- `AddNodeTool.ts` - Batch add nodes (supports layout parameter)
- `EditNodeTool.ts` - Batch update nodes/edges
- `LinkNodesTools.ts` - Batch create edges
- `RemoveNodesTool.ts` - Batch delete nodes
- `GetDiagramInfoTool.ts` - Retrieve diagram contents
- `FindNodesTool.ts` - Search nodes by filters
- `ListTabsTool.ts` - List all tabs in a file
- `CopyNodesTool.ts` - Copy nodes between files/tabs

#### index.ts - Server Entry Point
Initializes the MCP server and registers all tools. This is a simple bootstrap file that:
1. Imports all tool classes
2. Creates `McpServer` instance with tool array
3. Calls `run()` to start the stdio transport

#### McpServer.ts - MCP Framework
Wraps the `@modelcontextprotocol/sdk` to provide:
- Tool registration and schema listing
- Request routing to appropriate tool
- Error handling and logging

### Data Flow

```
MCP Client (e.g., Claude Desktop)
    ↓ (stdio)
McpServer.ts (routes requests)
    ↓
Individual Tool (e.g., AddNodeTool)
    ↓
GraphFileManager (loads/saves .drawio XML)
    ↓
Graph (mxGraph wrapper, in-memory operations)
    ↓
mxgraph library (via jsdom for Node.js compatibility)
```

### Multi-Tab Architecture

Draw.io files can contain multiple diagrams (tabs/pages). The structure is:
```xml
<mxfile>
  <diagram id="..." name="Tab 1">
    <mxGraphModel>...</mxGraphModel>
  </diagram>
  <diagram id="..." name="Tab 2">
    <mxGraphModel>...</mxGraphModel>
  </diagram>
</mxfile>
```

All tools that modify diagrams support a `tab` parameter (string name or numeric index). When saving:
- If tab doesn't exist, it's created
- If tab exists, only that tab is updated
- Other tabs remain unchanged

### Custom Data Properties

Nodes can store arbitrary metadata in the `data` field:
- Stored as JSON string in `cell.data` property
- Preserved during copy operations
- Searchable via `FindNodesTool` with `data` filter
- Merged during edits (not replaced)

### Edge Handling

The `linkNodes()` method has sophisticated edge management:
- Checks for existing edges in both directions before creating new ones
- Undirected edges use canonical ID format (alphabetically sorted node IDs)
- Existing edges are updated (label, style) rather than duplicated
- Edge styles support: dashed, reverse (arrow direction), undirected (no arrows)

## Important File Locations

- Source code: `src/`
- Build output: `dist/`
- TypeScript config: `tsconfig.json`
- Entry point: `src/index.ts` (shebang for CLI execution)
- Main graph logic: `src/Graph.ts` (496 lines)
- File I/O: `src/GraphFileManager.ts` (266 lines)

## Development Notes

### mxGraph Integration
The project uses mxgraph 4.2.2 with a jsdom shim (`src/mxgraph/jsdom.ts`) to provide browser-like DOM APIs in Node.js. This allows mxgraph to run server-side.

### TypeScript Configuration
- Module system: ESNext with ES2020 target
- Strict mode: Disabled (`strict: false`, `noImplicitAny: false`)
- Output: ESM with `.js` extensions in imports
- Declaration files and source maps are generated

### Path Handling
All file paths in tools are resolved to absolute paths using `path.resolve()`. Both relative and absolute paths are accepted as input.

### Error Handling
Tools throw `McpError` with appropriate error codes:
- `ErrorCode.InvalidParams` - Invalid input parameters
- `ErrorCode.MethodNotFound` - Tool not found
- `ErrorCode.InternalError` - Unexpected errors

## Node Kind Support

The following node kinds are available (defined in `Graph.Kinds`):
- `Rectangle` - Default rounded rectangle (120×60)
- `RoundedRectangle` - Rectangle with customizable corner radius via `corner_radius` parameter
- `Ellipse` - Oval shape (120×80)
- `Cylinder` - Database/storage (60×80)
- `Cloud` - Cloud service (120×80)
- `Square` - Fixed aspect ratio (80×80)
- `Circle` - Circular (80×80)
- `Step` - Process step (120×80)
- `Actor` - UML actor/stick figure (30×60)
- `Text` - Text-only, no border (60×30)

Each kind has default width/height and style properties. The `Graph.normalizeKind()` method handles typo corrections (e.g., "Elipse" → "Ellipse").

## Table Support

The project supports high-level table abstractions for creating and managing tabular data in diagrams.

### Table Architecture

Tables are implemented as container nodes with child cells:
- **Container node**: Parent node with metadata in `data.table` property
- **Cell IDs**: Follow convention `${tableId}_r${row}_c${col}` for data cells, `${tableId}_header_c${col}` for headers
- **Coordinate system**: Child cells use relative coordinates within the container
- **Metadata structure**:
  ```json
  {
    "table": {
      "type": "table",
      "columns": ["ID", "Name", "Email"],
      "cellWidth": 100,
      "cellHeight": 30
    }
  }
  ```

### Table Methods in Graph.ts

- `addTable()` - Create table with headers and rows
- `getTableInfo()` - Get table structure and data
- `copyTable()` - Copy table to new location (preserves structure and data)
- `addTableColumn()` - Add new column with default values
- `renameTableColumn()` - Rename column header
- `updateTableCell()` - Update single cell value
- `addTableRow()` - Insert new data row
- `removeTableColumn()` - Delete column
- `removeTableRow()` - Delete row
- `linkToTableCell()` - Create edge to specific cell
- `findTables()` - Search tables by criteria (supports title, data property, and column filters)

### Table Tools

Six MCP tools provide table operations:
- **CreateTableTool** (`create_table`) - Create new tables
- **EditTableTool** (`edit_table`) - Modify tables with batch operations
- **LinkToTableCellTool** (`link_to_table_cell`) - Connect nodes to cells
- **FindTablesTool** (`find_tables`) - Search tables (supports filters: id, title, data properties, columns, row count)
- **GetTableInfoTool** (`get_table_info`) - Retrieve table structure
- **CopyTableTool** (`copy_table`) - Copy tables between files/tabs preserving structure

### Parent Validation

The `Graph.validateParent()` helper ensures parent nodes exist before creating children, preventing orphaned cells.

### Cell Addressing

Cells can be addressed by:
- **Row index** (0-based): First data row is 0
- **Column name** (header string): "Email", "Status", etc.
- **Column index** (0-based): First column is 0

Example: To reference the "Status" column in row 2, use `{row: 2, column: "Status"}` or `{row: 2, column: 3}`.

## Package Information

- Package name: `drawio-mcp`
- Binary: Exports `drawio-mcp` command
- License: ISC
- Repository: https://github.com/Sujimoshi/drawio-mcp
- Node.js requirement: >=18.0.0
