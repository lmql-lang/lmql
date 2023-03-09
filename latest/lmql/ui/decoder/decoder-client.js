let graph = {
    nodes: [],
    existing_nodes: new Set(),
    edges: []
}

window.renderer = {
    add_result: (data) => {
        window.localStorage.setItem("graph", JSON.stringify({nodes: graph.nodes, edges: graph.edges}))

        graph = {
            nodes: data.nodes,
            edges: data.edges,
        }

        console.log("graph", graph)

        render(graph)
    },
    clear: () => {
    }
}

// on load restore graph
let graph_json = window.localStorage.getItem("graph")
if (graph_json) {
    let stored_graph = JSON.parse(graph_json)
    graph.nodes = stored_graph.nodes
    graph.edges = stored_graph.edges
    console.log("restored graph", graph)
}

function render(graph) {
    const uniqueEdges = new Map()
    graph.edges.forEach(e => {
        let edge = uniqueEdges.get(e[0])
        if (!edge) {
            edge = new Set()
            uniqueEdges.set(e[0], edge)
        }
        edge.add(e[1])
    })

    const cy = cytoscape({
        container: document.getElementById('decoder-graph'),

        boxSelectionEnabled: false,
        autounselectify: true,

        style: [
          {
            selector: 'node',
            style: {
                // very light gray
                'background-color': '#f5f5f5',
                'label': 'data(label)',
                'shape': 'roundrectangle',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'wrap',
                'text-max-width': '100px',
                'text-justification': 'center',
                'color': '#505050',
                'font-size': '20px',
                'border-color': '#e2e2e2',
                'border-width': '1px',
            }
          },
        //   compound nodes
          {
            selector: 'node.compound',
            style: {
                'background-color': '#f5f5f5',
                'color': '#505050',
                'font-size': '10px',
                'shape': 'roundrectangle',
                // text top center but inside node
                'text-valign': 'top',
                'text-halign': 'center',
                'text-wrap': 'wrap',
                'font-weight': 'bold',
                'font-size': '8pt',
                'background-color': 'white',
            }
          },
          {
            selector: 'node.stopped',
            style: {
                'background-color': 'white',
                'background-opacity': 0.0,
                'color': '#505050',
                'border-color': 'white',
                'border-width': '0px',
            }
          },
          //   active nodes
          {
            selector: 'node.active',
            style: {
                'background-color': '#337ab7',
                'background-opacity': 1.0,
                'color': 'white',
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'target-arrow-shape': 'triangle',
              'line-color': '#9dbaea',
              'target-arrow-color': '#9dbaea',
              "curve-style": "straight",
            }
          },
          {
            selector: 'edge.active',
            style: {
                'line-color': '#337ab7',
                'target-arrow-color': '#337ab7',
                'width': 4,
            }
          }
        ],

        elements: {
          nodes: graph.nodes.map(n => ({
                data: {
                    ...n,
                    id: n.id,
                    // replace space by utf-8 0x23b5
                    label: n.text[0].replace(/ /g, "\u23b5")
                }
        })),
          edges: Array.from(uniqueEdges).map(([from, tos]) => Array.from(tos).map(to => ({
            data: {
                source: from,
                target: to
            }
            }))).flat()
        }
      });
    
    const rootNodes = cy.nodes().filter(n => n.indegree() == 0)
    let x = 0
    let columnItems = new Map()
    let cellWidth = 170
    let cellHeight = 50

    cy.elements().depthFirstSearch({
        roots: rootNodes,
        visit: (node, edge, previous, i, depth) => {
            let column = columnItems.get(depth)
            if (!columnItems.has(depth)) {
                column = [[node.id(), node.data("seqlogprob")]]
                columnItems.set(depth, column)
            } else {
                column.push([node.id(), node.data("seqlogprob")])
                columnItems.set(depth, column)
            }
        },
        directed: true
    });

    // set node width based on label
    cy.nodes().forEach(n => {
        // set label to label (seqlogprob)
        let label = n.data("label") // + " (" + n.data("seqlogprob").toFixed(2) + ")"
        n.data("label", label)

        let width = label.length * 8
        n.style("width", Math.max(width, 30))
    })

    Array.from(columnItems.keys()).forEach(k => {
        let column = columnItems.get(k)
        column.sort((a,b) => (a[1] > b[1] ? -1 : 1))
        // turn into map to index
        column = new Map(column.map((v,i) => [v[0], i]))
        columnItems.set(k, column)
    })

    let compoundNodes = new Set()

    cy.nodes().forEach(n => {
        let pool = n.data("pool")
        if (compoundNodes.has(pool)) {
            return
        }
        if (!pool) {
            return
        }

        let compoundNode = cy.add({
            group: "nodes",
            data: {
                id: "compound_" + pool,
                label: pool,
            }
        })
        compoundNode.addClass("compound")
        compoundNodes.add(pool)
    })

    let maxDepth = Math.max(...Array.from(columnItems.keys()))

    // set .stopped for all nodes without outgoing edges
    cy.elements().depthFirstSearch({
        roots: rootNodes,
        visit: (n, edge, previous, i, depth) => {
            if (depth >= maxDepth) return;
            // no outgoers and not compound node
            if (n.outgoers().length == 0 && !n.hasClass("compound")) {
                n.addClass("stopped")
            }
        },
        directed: true
    });

    cy.elements().depthFirstSearch({
        roots: rootNodes,
        visit: (node, edge, previous, i, depth) => {
            let column = columnItems.get(depth).get(node.id())
            node.position({x: depth * cellWidth, y: cellHeight * column})
            let pool = node.data("pool")
            if (pool) {
                node.move({parent: "compound_" + pool})
            }
        },
        directed: true
    });

    // when clicking a node, highlight all paths to root
    cy.on('tap', 'node', function(evt){
        let node = evt.target
        // remove active otherwise
        cy.elements().removeClass("active")
        highlightPathTo(rootNodes, node)
    })

    // tap anywhere clear active
    cy.on('tap', function(evt){
        if (evt.target === cy) {
            cy.elements().removeClass("active")
        }
    })

    cy.fit()
    cy.zoom(cy.zoom() * 0.8)
    // zoom out
}

function highlightPathTo(root, target) {
    if (root.id() == target.id()) {
        root.addClass("active")
        return true
    } else {
        const isActive = root.outgoers().reduce((acc, n) => {
            let isActive = highlightPathTo(n, target) 
            if (isActive) {
                // add .active to edge from root to n
                root.edgesWith(n).addClass("active")
            }
            return isActive || acc
        })
        if (isActive) {
            root.addClass("active")
            return true;
        }
    }
}

render(graph)