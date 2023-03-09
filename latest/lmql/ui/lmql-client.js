const useState = React.useState;

let state = {
    data: {
        hypotheses: {},
        discarded: [],
        globalTokenIndex: 0,
        compiled: "",
        selectedHypothesis: null,
        latestHypothesis: null,
        selectLatest: true,
        decoderGraph: {
            nodes: [],
            edges: []
        }
    },
    setState: s => {
        state.data = Object.assign(state.data, s);
        state.listeners.forEach(l => l(state.data));
    },
    listeners: []
}

function selectLatestHypothesis() {
    state.setState({
        selectedHypothesis: state.data.latestHypothesis,
        selectLatest: true
    })
}

function selectHypothesis(h) {
    state.setState({
        selectedHypothesis: h,
        selectLatest: false
    })
}

function result_id(h) {
    if (!h) return null;
    return h.result_id;
}

function TokenWindow(props) {
    const scrollviewRef = React.useRef()
    
    React.useEffect(() => {
        scrollviewRef.current.scrollLeft = scrollviewRef.current.scrollWidth;
    }, [])
    
    const token_classes = (t) => {
        let classes = "token"

        if (t.variable == "<PROMPTING>") {
            classes += " prompt"
        }

        if (result_id(t) == result_id(state.data.selectedHypothesis)) {
            classes += " selected"
        }

        if (t.valid == "True") {
            classes += " valid"
        } else if (t.valid == "False" && t.final == "fin") {
            classes += " invalid"
        }

        return classes
    }

    let variable = props.variable;
    if (variable == "__done__") {
        variable = "DONE";
    }

    function present(t) {
        if (t == "") {
            return <span className="white-space">ᐧ</span>
        } else {
            return t.replace("\n", "[NEWLINE]");
        }
    }

    return <div className="hypothesis">
        <span className="variable-badge">#{props.head}: {variable}</span>
        <div className="token-window" ref={scrollviewRef}>
            {props.tokens.map((t,i) => <span className={token_classes(t[1])} key={i} 
                onClick={() => selectHypothesis(t[1])}>{present(t[0])}</span>)}
        </div>
    </div>
}

function Hypothesis(props) {
    let h = props.hypothesis

    let tokens = []
    let current = h;
    let p = h.predecessor;
    while (p) {
        tokens.push([current.prompt.substr(p.prompt.length), current])
        current = p;
        p = p.predecessor;
    }
    tokens.push(["<START>", current])
    tokens.reverse()

    return <TokenWindow tokens={tokens} variable={h.variable} head={h.head_index}/>
}

function layoutDecoderGraph(cy) {
    const rootNodes = cy.nodes().filter(n => n.indegree() == 0)
    let x = 0
    let columnItems = new Map()
    let cellWidth = 150
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
        // skip compound
        if (n.hasClass("compound")) return
        // set label to label (seqlogprob)
        let seqlogprob = n.data("seqlogprob")
        // if seqlogprob is a number
        if (typeof seqlogprob === "number") {
            seqlogprob = seqlogprob.toFixed(2)
        } else if (typeof seqlogprob === "string") {
            // parse inf, -inf
            if (seqlogprob == "inf") {
                seqlogprob = Infinity
            } else if (seqlogprob == "-inf") {
                seqlogprob = -Infinity
            } else {
                seqlogprob = -9999
            }
        } else {
            seqlogprob = -9999
        }
        let label = n.data("label") + "\n(" + seqlogprob + ")"
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

        let id = "compound_" + pool

        if (cy.getElementById(id).length > 0) {
            return
        }

        let compoundNode = cy.add({
            group: "nodes",
            data: {
                id: id,
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
            if (node.data("layouted")) return;
            if (node.hasClass("compound")) return;

            let column = columnItems.get(depth).get(node.id())
            node.position({x: depth * cellWidth, y: cellHeight * column})
            node.data("layouted", true)

            let pool = node.data("pool")
            if (pool) {
                node.move({parent: "compound_" + pool})
            }
        },
        directed: true
    });
}

function initDecoderGraphCy(element) {
    return cytoscape({
        container: element,

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
                'font-size': '10px',
                'border-color': '#e2e2e2',
                'border-width': '1px',
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
            // node with data.deterministic
            {
                selector: 'node[deterministic]',
                style: {
                    // light blue
                    'background-color': '#9dbaea',
                    'background-opacity': 1.0,
                    'color': 'white',
                    'border-color': 'grey',
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
            //   compound nodes
            {
                selector: 'node.compound, node.compound.active',
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
                selector: 'node.active[deterministic]',
                style: {
                    'background-color': '#334768',
                    'background-opacity': 1.0,
                    'color': 'white',
                    'border-color': 'grey',
                    'border-width': '0px',
                }
            },
            {
            selector: 'edge',
            style: {
                'width': 2,
                'target-arrow-shape': 'triangle',
                'line-color': '#9dbaea',
                'target-arrow-color': '#9dbaea',
                "curve-style": "bezier",
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
            nodes: [],
            edges: []
        }
    });
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

function DecoderGraph(props) {
    const graphElementRef = React.useRef();
    const [cyData, setCyData] = useState(null);
    const [cy, setCy] = useState(null);
    const [activeNode, setActiveNode] = useState(null);

    React.useEffect(() => {
        const cy = initDecoderGraphCy(graphElementRef.current)
        setCy(cy);
            
        // when clicking a node, highlight all paths to root
        cy.on('tap', 'node', function(evt){
            let node = evt.target
            let rootNodes = cy.nodes().filter(n => n.indegree() == 0)
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
    }, [graphElementRef])

    React.useEffect(() => {
        if (cy) {
            if (cyData) {
                setActiveNode(null)
                // cy.nodes().remove()
                // cy.edges().remove()

                // collect unique edges
                const uniqueEdges = new Map()
                cyData.edges.forEach(e => {
                    let edge = uniqueEdges.get(e[0])
                    if (!edge) {
                        edge = new Set()
                        uniqueEdges.set(e[0], edge)
                    }
                    edge.add(e[1])
                })

                function strLabel(label) {
                    label = label.replace(/ /g, "\u23b5")
                    if (label.length > 20) {
                        return label.substring(0, 20) + "..."
                    }
                    return label
                }

                // transform nodes and edges
                cyData.nodes.forEach(node => {
                    let n = {
                        data: {
                            ...node,
                            id: node.id,
                            // replace space by utf-8 0x23b5
                            label: strLabel(node.text[0])
                        }
                    };
                    // get node with id node.id
                    let existingNode = cy.getElementById(node.id)
                    if (existingNode.length > 0) {
                        // update node
                        existingNode.data(n.data)
                    } else {
                        cy.add({group: "nodes", ...n})
                    }
                })
                
                Array.from(uniqueEdges).forEach(([from, tos]) => Array.from(tos).forEach(to => {
                    let existingSource = cy.getElementById(from)
                    let existingTarget = cy.getElementById(to)
                    if (existingSource.edgesTo(existingTarget).length > 0) {
                        // edge already exists
                        return
                    }
                    let e ={
                        data: {
                            source: from,
                            target: to
                        }
                    };
                    cy.add({group: "edges", ...e})
                }))

                // cy.fit();
                layoutDecoderGraph(cy)
            }
        }
    }, [cyData, cy])

    state.listeners.push(s => {
        setCyData(s.decoderGraph)
    })

    let style = props.style

    return <div className="graph" style={style} ref={graphElementRef}></div>
}

function HypothesesTable() {
    const [hypotheses, setHypotheses] = useState({
        hypotheses: {}
    });
    const [discarded, setDiscarded] = useState([]);
    const [activeToken, setActiveToken] = useState(1)
    const [tokenSliderValue, setTokenSliderValue] = useState(1)
    const [realtime, setRealtime] = useState(true)
    const [globalTokenIndex, setGlobalTokenIndex] = useState(0)

    const [hasDecoderGraph, setHasDecoderGraph] = useState(false)
    const [decoderGraph, setDecoderGraph] = useState({nodes: [], edges: []})

    state.listeners.push(s => {
        setHypotheses(s.hypotheses)
        setDiscarded(s.discarded)
        setGlobalTokenIndex(s.globalTokenIndex)
        if (s.globalTokenIndex < activeToken) {
            setActiveToken(1)
            setTokenSliderValue(1)
        }
        setHasDecoderGraph(s.decoderGraph.nodes.length > 0)
        setDecoderGraph(s.decoderGraph)
    })

    let sortedKeys = Array.from(Object.keys(hypotheses).map(i => parseInt(i)))
    sortedKeys.sort()

    let activeIndex = activeToken;
    let activeTokenSliderValue = tokenSliderValue;
    
    if (realtime) {
        activeIndex = globalTokenIndex
        activeTokenSliderValue = sortedKeys.indexOf(globalTokenIndex)
    }

    let elements = hypotheses[activeIndex] || []
    elements = elements.filter(h => h.prompt)

    let discardedElements = discarded.filter(h => h.num_tokens < parseInt(activeIndex))
    discardedElements = discardedElements.filter(h => h.prompt)
    discardedElements.sort((a,b) => a.length > b.length ? 1 : -1)

    const changeSlider = e => {
        setRealtime(parseInt(e.target.value) == parseInt(globalTokenIndex))
        setActiveToken(sortedKeys[e.target.value])
        setTokenSliderValue(e.target.value)
    }

    return hasDecoderGraph ?
        <TabView className="hypotheses" tabs={["Decoder Graph"]}>
            <DecoderGraph style={{flex: 1}}/>
        </TabView> :
        <TabView className="hypotheses" tabs={["Decoder (Legacy)"]}>
            <div className="data">
            <div className="decoder-slider" >
                Progress
                <input type="range" value={activeTokenSliderValue} onChange={changeSlider} min={0} max={sortedKeys.length - 1}/><br/>
            </div>
            <h2>Active</h2>
            {elements.map(e => <Hypothesis key={e.variable + "_" + e.prompt + "_" + e.head_index + "_" + e.num_tokens} hypothesis={e}/>)}
            <h2>Discarded</h2>
            {discardedElements.map(e => <Hypothesis key={e.variable + "_" + e.prompt + "_" + e.head_index + "_" + e.num_tokens} hypothesis={e}/>)}
            </div>
        </TabView>
}

let result_counter = 0

window.renderer = {
    add_result: (data) => {
        if (data.type == "compiled-code") {
            state.setState({
                compiled: data.data
            })
        } else if (data.type == "interpreter-head") {
            let latest_state = state.data
            let existing = latest_state.hypotheses
            let hypothesis = data.data
            
            // assign each result a unique id
            hypothesis.result_id = result_counter
            result_counter += 1;
            
            let num_tokens = hypothesis.num_tokens
            let max_tokens = 0;

            if (existing[num_tokens]) {
                existing[num_tokens].push(hypothesis)
            } else {
                existing[num_tokens] = [hypothesis]
            }

            let sortedKeys = Array.from(Object.keys(existing).map(i => parseInt(i)))
            sortedKeys.sort()

            Object.keys(existing).forEach(i => {
                existing[i].forEach(h => {
                    h.successors = [];
                    h.predecessor = undefined;
                })
            })

            Object.keys(existing).forEach(i => {
                i = parseInt(i)
                max_tokens = Math.max(i, max_tokens);
                
                let nextTokenHypotheses = []
                let index_position = sortedKeys.indexOf(i);
                if (index_position != -1 && index_position + 1 < sortedKeys.length) {
                    let next_num_tokens = sortedKeys[index_position + 1]
                    nextTokenHypotheses = existing[next_num_tokens]
                }

                existing[i].forEach(h => {
                    nextTokenHypotheses.forEach(nh => {
                        if (nh.prompt.startsWith(h.prompt)) {
                            if (nh.predecessor) {
                                if (nh.predecessor.head_index != nh.head_index && h.head_index == nh.head_index) {
                                    nh.predecessor.successors = nh.predecessor.successors.filter(s => s !== nh)
                                    nh.predecessor = h
                                    h.successors.push(nh)
                                }
                            } else {
                                nh.predecessor = h;
                                h.successors.push(nh)
                            }
                        }
                    })
                })
            })

            let discarded = [];
            Object.keys(existing).forEach(i => {
                i = parseInt(i)
                
                existing[i].forEach(h => {
                    if (h.successors.length == 0 && h.num_tokens != max_tokens) {
                        discarded.push(h);
                    }
                })
            })

            let updatedState = {
                hypotheses: existing,
                discarded: discarded,
                globalTokenIndex: max_tokens
            }

            let latestHypotheses = existing[max_tokens]
            if (latestHypotheses.length > 0) {
                if (state.data.selectLatest) {
                    updatedState.selectedHypothesis = latestHypotheses[0]
                }
                updatedState.latestHypothesis = latestHypotheses[0]
            }

            state.setState(updatedState)
        } else if (data.type == "decoder-graph-state") {
            state.setState({
                decoderGraph: data.data
            })
        } else {
            log_to_console("Received unknown result data type: " + data.type)
        }
    },
    clear: () => {
        state.setState({
            hypotheses: {},
            discarded: [],
            globalTokenIndex: 0,
            compiled: "",
            selectedHypothesis: null,
            latestHypothesis: null,
            selectLatest: true,
            decoderGraph: {
                nodes: [],
                edges: []
            }
        })
    }
}

function CodeSidebar() {
    const [compiled, setCompiled] = useState("")
    const [hidden, setHidden] = useState("")

    state.listeners.push(s => {
        setCompiled(s.compiled.code)
    })

    if (hidden) {
        document.getElementById("lmql-compiled").classList.add("hidden")
    } else {
        document.getElementById("lmql-compiled").classList.remove("hidden")
    }

    return <div className={"content" + (hidden ? " hidden" : "")}>
        <textarea readOnly={true} value={compiled}></textarea>
    </div>
}

function ProgramStateView() {
    const [hypothesis, setHypothesis] = useState(null);
    const [selectLatest, setSelectLatest] = useState(null);

    state.listeners.push(s => {
        setHypothesis(prev => {
            return s.selectedHypothesis
        })
        setSelectLatest(s.selectLatest)
    })

    if (!hypothesis) {
        return <div className="full-text-view">
            <i>No Selection</i>
        </div>
    }

    let program_variables = hypothesis.program_variables || {}
    let head_index = typeof hypothesis.head_index !== "undefined" ? hypothesis.head_index : "-"
    
    let variable = (hypothesis.variable == "__done__" ? "-" : hypothesis.variable) || "-";
    let interpreterState = (hypothesis.variable == "__done__" ? "Finished" : "Decoding") || "-";
    if (hypothesis.variable == "<PROMPTING>") {
        interpreterState = "Prompting"
    }
    
    let valid = hypothesis.valid || "-";
    let final = hypothesis.final || "undetermined";
    let mask = hypothesis.mask || "-";
    mask = mask.replace("\n", "[NEWLINE]");
    
    let successors = hypothesis.successors || []

    return <div className="full-text-view">
        <h2>Full Text</h2>
        <div className="readonly-box">
            {hypothesis.prompt}
        </div>
        {/* Previous Hypothesis: 
        <div className="readonly-box">
            {hypothesis.predecessor ? hypothesis.predecessor.prompt : "<none>"}
        </div>
        Successor Hypotheses:
        {successors.map(s => <div className="readonly-box">A {s.prompt}</div>)}  */}
        
        <h2>Interpreter Head</h2>
        <div className="program-variable">
            <span className="variable-name">Index:</span> 
            {head_index}
        </div>
        <div className="program-variable">
            <span className="variable-name">Currently Decoded Variable:</span> 
            {variable}
        </div>
        <div className="program-variable">
            <span className="variable-name">Interpreter State:</span> 
            {interpreterState}
        </div>
        <h2>Validation</h2>
        <div className="program-variable">
            <span className="variable-name">Valid:</span> 
            {`${final}(${valid})`}
        </div>
        <div className="program-variable">
            <span className="variable-name">Mask:</span> 
            {`${mask}`}
        </div>
        <h2>Variables</h2>
        {Object.keys(program_variables).map(k => 
            <div className="program-variable" key={k}>
                <span className="variable-name">{k}</span> 
                {JSON.stringify(program_variables[k])}
            </div>
        )}
    </div>
}

function ValidationGraphView(props) {
    const graphElementRef = React.useRef();
    const [cyData, setCyData] = useState(null);
    const [cy, setCy] = useState(null);
    const [activeNode, setActiveNode] = useState(null);

    React.useEffect(() => {
        const cy = initCytoscape(graphElementRef.current)
        setCy(cy);

        cy.on("click", e => {
            if (e.target && e.target.isNode && e.target.isNode()) {
                setActiveNode(e.target.data())
            } else {
                setActiveNode(null)
            }
        })
    }, [graphElementRef])

    React.useEffect(() => {
        if (cy) {
            if (cyData) {
                setActiveNode(null)
                cy.nodes().remove()
                cy.edges().remove()
                cyData.nodes.forEach(n => {
                    let label = n.data.label;
                    n.data.original_label = label
                    
                    // derive value and finalness
                    let [value, final] = n.data.result
                    let result_str = `${final}(${value})`
                    n.data.label = label + " " + result_str.substring(0, 12) + (result_str.length > 12 ? "..." : "")
                    
                    // derive color
                    if (final == "fin" && value == false) {
                        n.data.color = "rgb(191, 83, 83)"
                    } else if (value == false) {
                        n.data.color = "rgb(246, 185, 163)"
                    } else if (final == "fin" && value == true) {
                        n.data.color = "rgb(69, 159, 69)"
                    } else if (value == true) {
                        n.data.color = "lightgreen"
                    } else {
                        n.data.color = "rgb(218, 210, 210)"
                    }
                    cy.add({group: "nodes", ...n})
                })
                cyData.edges.forEach(e => {
                    cy.add({group: "edges", ...e})
                })

                cy.layout({ name: 'dagre'}).run()
                cy.fit();
            }
        }
    }, [cyData, cy])

    state.listeners.push(s => {
        setCyData(prev => {
            let h = s.selectedHypothesis;
            if (h) {
                return JSON.parse(h.where)
            } else {
                return null
            }
        })
    })

    let content = "No selection."
    if (cyData) {
        content = JSON.stringify(cyData, null, 4)
    }

    let style = props.style
    return <div style={style} className="validation-graph">
        <InfoView node={activeNode}/>
        <div className="graph" ref={graphElementRef}></div>
    </div>
}

function InfoView(props) {
    if (!props.node) {
        return <div className="info-view hidden"></div>
    }

    let data = props.node;
    let repr = data.repr

    let [value, final] = data.result
    let result_str = `${final}(${JSON.stringify(value)})`

    return <div className="info-view">
        <h2>{repr}</h2>
        <div className="program-variable">
            <span className="variable-name">Value:</span> 
            {result_str}
        </div>
        <div className="program-variable">
            <span className="variable-name">Follow Map:</span> 
            {`${data.follow_map.replace("\n", "[NEWLINE]")}`}
        </div>
    </div>
}

function TabView(props) {
    const tabbarRef = React.useRef()

    React.useEffect(() => {
        initTabbar(tabbarRef.current)
    }, [tabbarRef])

    return <div className={"tabview " + props.className} ref={tabbarRef}>
        <ul className="tabbar">
            {props.tabs.map((t,i) => <li key={t} className={i == 0 ? "active" : ""}>{t}</li>)}
            {props.tabbarView || null}
        </ul>
        {props.children}
    </div>
}

function Inspector() {
    const [trackingLatest, setTrackingLatest] = useState(0)
    state.listeners.push(s => setTrackingLatest(s.selectLatest))

    return <TabView tabs={["Program State", "Validation"]} className="inspector" tabbarView={
        !trackingLatest ? <button onClick={() => selectLatestHypothesis()}>Track Latest</button> : null
    }>
        <ProgramStateView/>
        <ValidationGraphView style={{display: "none"}}/>
    </TabView>
}

function LMQLDebugger() {
    return <div className="lmql-debugger">
        <HypothesesTable/>
        <Inspector/>
    </div>
}

let element = document.getElementById("lmql-debugger");
element.style.height = "100%";
ReactDOM.createRoot(element).render(<LMQLDebugger/>);

element = document.getElementById("lmql-compiled")
ReactDOM.createRoot(element).render(<CodeSidebar/>);


if (window.location.pathname.split('/')[2] == "ast_mock") {
    run()
}

function initTabbar(tabviewElement) {
    let tabbar = tabviewElement.querySelector(".tabbar")
    let tabViews = Array.from(tabviewElement.childNodes).filter(n => n.nodeName == "DIV")
    let tabViewDisplay = tabViews.map(tv => tv.style.display == "none" ? "flex" : tv.style.display)
    let tabs = Array.from(tabbar.querySelectorAll("li"))
    
    tabs.forEach((t,i) => {
        t.addEventListener("click", () => {
            tabViews.forEach(tv => tv.style.display = "none")
            
            let tv = tabViews[i];
            if (tv) tv.style.display = tabViewDisplay[i];

            tabs.forEach(tb => tb.classList.remove("active"))
            t.classList.add("active")
        })
    })
}

initTabbar(document.getElementById("code-sidebar"))
initTabbar(document.getElementById("code-input"))

function lowestDepthFrom(nodes, root) {
    var toTraverse = [root];
    var visited = {};
    var depth = 0;
    var nodeDepths = {}
    while (toTraverse.length > 0) {
      let levelNodes = Array.from(toTraverse);
      toTraverse = [];
      for (let node of levelNodes) {
        visited[node.id()] = true;
        node.data("row", Math.max(depth, node.data("row") || -1));

        for (let child of node.outgoers()) {
          const target = child.target();
          // console.log(root.data("label"), "has outgoing edge to", child.source().data("label"), target.data("label"))
          if (!nodes.has(target)) continue;
          //if (visited[target.id()]) continue;
          if (!target.id()) continue

          toTraverse.push(target);
        }
      }
      depth++;
    }
  }

  function layout(cy) {
    const token_nodes = cy.filter("node[is_token=1]").sort((a, b) => {
      // parse index from SequenceOp: something (index)
      const aIndex = a.data("token_index")
      const bIndex = b.data("token_index")
      return aIndex - bIndex;
    })
    
    token_nodes.each((n) => {
      const index = n.data("token_index")
      n.data("column", index);

      n.successors().map(e => {
        if (!e.source().data("label")) return;
        if (!e.target().data("label")) return;
        // console.log(n.data("label") + "=>" + nn.data("label"));
        let existing = e.target().data("column") || 0;
        e.target().data("column", Math.max(existing, index));
      })
    })

    token_nodes.each(n => {
      const sameColumn = cy.nodes("node[column=" + n.data("column") + "]");
      lowestDepthFrom(sameColumn, n);
    })

    // determine tabular dimensions
    let dimensions = {};
    let numColumns = 0;
    let numRows = 0;
    cy.nodes().each(n => {
      const c = n.data("column");
      const r = n.data("row");

      if (typeof c === "undefined") return;
      if (typeof r === "undefined") return;
      
      if (dimensions[c] === undefined) {
        dimensions[c] = {};
      }
      if (dimensions[c][r] === undefined) {
        dimensions[c][r] = 0;
      }

      n.data("row-index", dimensions[c][r]);
      dimensions[c][r]++;

      numColumns = Math.max(numColumns, c || 0);
      numRows = Math.max(numRows, r || 0);
    })

    // for nodes that have not been assigned a row/column
    cy.nodes().each((n) => {
      // console.log("set position for ", n.data("label"), n.data("column"), n.data("row"))
      if (n.data("column") === undefined || n.data("row") === undefined) {
        // find successor rows and columns
        let successorColumns = [];
        let successorRows = [];
        
        let minRow = 0;
        let meanColumn = 0;
        let numSuccessors = 0;
        
        n.successors().map(e => {
          if (e.target().data("column") === undefined) return;
          if (e.target().data("row") === undefined) return;
          
          minRow = Math.min(minRow, e.target().data("row"));
          meanColumn += e.target().data("column");
          numSuccessors += 1;
        })
        
        const c = numSuccessors != 0 ? Math.floor(meanColumn / numSuccessors) : 0;
        const r = Math.max(-1, minRow - 1);

        if (dimensions[c] === undefined) {
          dimensions[c] = {};
        }
        if (dimensions[c][r] === undefined) {
          dimensions[c][r] = 0;
        }

        n.data("column", c);
        n.data("row", r);
        n.data("row-index", dimensions[c][r]);
        dimensions[c][r]++;

        // console.log("set mean position for ", n.data("label"), n.data("column"), n.data("row"))
      } else if (n.data("op") == "ValidationResultOp") {
        n.data("row", numRows)
      }
    })

    // print dimensions matrix
    for (let c = 0; c <= numRows; c++) {
      let row = "";
      for (let r = 0; r <= numColumns; r++) {
        if (dimensions[r] && dimensions[r][c]) {
          row += "" + dimensions[r][c];
        } else {
          row += "0";
        }
        row += " ";
      }
    }

    let columnWidths = [];
    // determine max dimensions per row and column
    for (let i=0; i<=numColumns; i++) {
      let max = 0;
      for (let j=0; j<=numRows; j++) {
        max = Math.max(max, dimensions[i][j] || 0);
      }
      columnWidths.push(max);
    }

    let rowHeights = [];
    for (let j=0; j<=numRows; j++) {
      let max = 0;
      for (let i=0; i<=numColumns; i++) {
        max = Math.max(max, dimensions[i][j] || 0);
      }
      rowHeights.push(max);
    }

    let nodeWidth = 120;
    let accumulatedColumnWidths = [];
    let sum = 0;
    
    for (let i=0; i<=numColumns; i++) {
      accumulatedColumnWidths.push(sum);
      sum += columnWidths[i] * nodeWidth;
    }

    cy.nodes().each((n) => {
      // console.log("set position for ", n.data("label"), n.data("column"), n.data("row"), n.data("row-index"))
      if (n.data("column") === undefined || n.data("row") === undefined) {
        n.data("floating", true);
        return;
      }
      n.position({
        x: accumulatedColumnWidths[(n.data("column") || 0)] + n.data("row-index") * nodeWidth,
        y: (n.data("row") || 0) * nodeWidth,
      });
    });
  }

function initCytoscape(element) {
    const cy = cytoscape({
      container: element,

      boxSelectionEnabled: false,
      autounselectify: true,

      style: [
        {
          selector: 'node',
          style: {
            // light gray
            'background-color': 'data(color)',
            "shape": "round-rectangle",
            // size
            'width': 80,
            'height': 40,
            "label": "data(label)",
            "font-size": "8px",
            "text-valign": "center",
            "text-halign": "center",
          }
        },
        {
          selector: 'node[is_token=1]',
          style: {
            'label': 'data(token)',
            'background-color': '#f5f5f5',
            'border-color': '#b0b0b0',
            'border-width': '1px',
            'padding': '2px',
            'font-size': '14px',
            'shape': 'rectangle',
            'width': 50,
            'height': 30,
          }
        },
        {
          selector: 'node[is_true]',
          style: {
            'border-color': 'green',
            'border-width': '2px',
            // light green
            'background-color': '#e0ffd0',
          },
        },
        {
          selector: 'node[is_false]',
          style: {
            'border-color': 'red',
            'border-width': '2px',
            // light red
            'background-color': '#ffd0d0',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],

      elements: {}
    });
    // layout(cy);
    cy.fit();
    return cy
};

ArgumentProviders.providers.push(() => {
    const argumentsTextarea = document.getElementById("query-arguments");
    return argumentsTextarea.value.split("\n");
})

// store contens of query-arguments in localStore 
const argumentsTextarea = document.getElementById("query-arguments");
argumentsTextarea.addEventListener("keydown", (e) => {
    localStorage.setItem("query-arguments", argumentsTextarea.value);
})

// onload restore
const storedArguments = localStorage.getItem("query-arguments");
if (storedArguments) {
    argumentsTextarea.value = storedArguments;
}