import './graph-layout.css';

import styled from 'styled-components';
import Editor from "@monaco-editor/react";
import React, { useEffect, useRef, useState } from "react";
import { registerLmqlLanguage } from "./editor/lmql-monaco-language";
import { BsSquare, BsFillHddNetworkFill, BsArrowRightCircle, BsCheckSquare, BsFileArrowDownFill, BsLayoutWtf, BsKeyFill, BsTerminal, BsFileCode, BsGithub, BsCardList, BsFullscreen, BsXCircle, BsFillChatLeftTextFill, BsFileBarGraph, BsGear } from 'react-icons/bs';
import { DecoderGraph } from './DecoderGraph';
import { BUILD_INFO } from './build_info';
import spinner from "./spinner.svg"
import exploreIcon from "./explore.svg"
import { ExploreState, Explore, PromptPopup, Dialog } from './Explore'
import { persistedState, trackingState } from "./State"
import { configuration, LMQLProcess, isLocalMode, isLocalModeCapable, setLMQLDistribution } from './Configuration';
import { ValidationGraph } from "./ValidationGraph";
import { DataListView } from "./DataListView";

import {reconstructTaggedModelResult} from "./tagged-model-result"

const Spinner = styled.img.attrs(props => ({ src: spinner }))`
  width: 24pt;
  height: 24pt;
  transform: scale(0.8);
`

const ExploreIc = styled.img.attrs(props => ({ src: exploreIcon }))`
  width: 8pt;
  height: 8pt;
  position: relative;
  top: 0pt;
  right: 2pt;
`

const ResizeObservers = {
  addResizeListener: l => ResizeObservers.listeners.push(l),
  removeResizeListener: l => ResizeObservers.listeners = ResizeObservers.listeners.filter(x => x !== l),
  listeners: [],
  notify: () => ResizeObservers.listeners.forEach(l => l()),
}

const bg = '#1e1e1e';

const ContentContainer = styled.div`
  /* width: 900pt; */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  
  color: white;
  flex: 1;
  height: 100%;
  width: 100%;
`;

const Panel = styled.div.attrs(props => ({ className: "panel" }))`
  /* min-height: 300pt; */
  background-color: ${bg};
  border-radius: 5pt;
  padding: 10px;
  display: flex;
  flex-direction: column;
  margin-left: 2.5pt;
  width: 40%;
  position: relative;

  // animate width and opacity change
  transition: width 0.1s, opacity 0.1s, padding 0.1s;
  overflow: hidden;

  // contained h2
  & > h2 {
    margin: 0;
    padding: 0;
    font-size: 10pt;
    font-weight: 400;
    color: #cccccc;
    margin-bottom: 5pt;
    display: flex;
    flex-direction: row;
  }

  // contained textarea
  & > textarea {
    width: 100%;
    height: 100%;
    background-color: ${bg};
    border: none;
    color: white;
    font-family: monospace;
    font-size: 14pt;
    outline: none;
    resize: none;

    // monospace font
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
    font-size: 14pt;
  }

  // when .sidebar
  &.with-sidebar {
    padding-right: 40pt;
  }

  // when .hidden
  &.hidden {
    width: 0pt;
    margin-left: 2pt;
    overflow: hidden;
    padding-left: 0;
    padding-right: 35pt
  }
  // when .stretch
  &.stretch {
    flex: 1;
    height: auto;
  }

  &.hidden .sidebar {
    border-left: none;
  }
`

const Title = styled.h1`
  font-size: 1.2em;
  margin-left: 5pt;
  margin-right: 15pt;
  text-align: left;
  font-weight: 400;
  font-family: 'Open Sans', sans-serif;
  color: ${bg};

  img {
    width: 12pt;
    height: 12pt;
    position: relative;
    margin-right: 9pt;
    margin-left: 5pt;
    top: 2pt;
  }
`;

const Sidebar = styled.div.attrs(props => ({ className: "sidebar" }))`
  width: 35pt;
  border-radius: 5pt;
  border-top-left-radius: 0pt;
  border-bottom-left-radius: 0pt;
  background-color: ${bg};
  border-left: 1px solid #333;
  margin-left: 2pt;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 3pt;
`

const TokenCountDiv = styled.div`
  font-size: 6pt;
  color: #a19a9a;
  flex: 1;
  /* position: absolute; */
  /* bottom: 10pt; */
  text-align: right;
  right: 20pt;
  z-index: -1;
  padding: 5pt;
  white-space: pre-line;
  max-height: 10pt;

  :hover .tooltip {
    visibility: visible;
    opacity: 1;
  }
`

function TokenCountIndicator() {
  const [stats, setStats] = useState({})

  const format_cost = (c, precision) => {
    c = c.toFixed(precision)
    if (c == (0).toFixed(precision))
      return "<$" + (Math.pow(10, -precision)).toFixed(precision);
    return "$" + c;
  }

  const cost_estimate = (model, k_tokens, precision = 2) => {
    if (model.includes("text-davinci")) {
      return `${format_cost(k_tokens * 0.02, precision)}`
    } else if (model.includes("text-ada")) {
      return `${format_cost(k_tokens * 0.0004, precision)}`
    } else if (model.includes("text-babbage")) {
      return `${format_cost(k_tokens * 0.0005, precision)}`
    } else if (model.includes("text-curie")) {
      return `${format_cost(k_tokens * 0.002, precision)}`
    } else {
      return ""
    }
  }

  useEffect(() => {
    let interval = window.setInterval(() => {
      setStats(s => {
        if (s == null || Object.keys(s).length == 0) {
          return {}
        } else {
          return {
            ...s,
            _now: Date.now()
          }
        }
      })
    }, 1000)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const onStatus = s => {
      if (s.status == "idle") {
        setStats(s => ({ ...s, _end: Date.now() }))
      }
    }
    LMQLProcess.on("status", onStatus)
    
    const renderer = {
      add_result: (data) => {
        if (data.type == "openai-token-count") {
          setStats(s => {
            if (s == null || Object.keys(s).length == 0) {
              return {
                ...data.data,
                _start: Date.now()
              }
            } else {
              return {
                ...s,
                ...data.data,
              }
            }
          })
        }
      },
      clear_results: () => setStats({})
    };
    LMQLProcess.on("render", renderer)
    return () => {
      LMQLProcess.remove("render", renderer)
      LMQLProcess.remove("status", onStatus)
    }
  }, [])

  let text = ""
  let compact = ""
  let tokenCount = 0;
  let model = ""
  let steps = 1;
  if (stats.tokens) {
    tokenCount = stats.tokens
    model = stats.model
    steps = stats._step || 1
    // first upper 
    const otherKeys = Object.keys(stats)
      .filter(k => k != "tokens")
      .filter(k => !k.startsWith("_"))
      .filter(k => k != "model")
    const toFirstUpper = k => k.charAt(0).toUpperCase() + k.slice(1)
    text = `Tokens: ${tokenCount}, ${otherKeys.map(k => `${toFirstUpper(k)}: ${stats[k]}`).join(", ")}`

    compact = `Consumed Tokens: ${tokenCount}`

    // time elapsed
    if (stats._start) {
      const end = stats._end || stats._now || Date.now();
      const elapsed = (end - stats._start) / 1000
      text += `\n Time: ${elapsed.toFixed(1)}s, `
    }

    text += `${(tokenCount / steps).toFixed(2)} tok/step`
    if (model.includes("openai")) {
      text += ` Est. Cost ${cost_estimate(model, tokenCount / 1000, 4)}`
    }
    compact += `\nEst. Cost ${cost_estimate(model, tokenCount / 1000, 4)}`
  }

  return <TokenCountDiv>
    {text}
  </TokenCountDiv>
}

const PlotContainer = styled.div`
  flex: 1;
  padding: 10pt;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;

  svg.main-svg {
    border-radius: 5pt;
    overflow: hidden;
  }
`


// function StatisticsPanelContent(props) {
//   const [stats, setStats] = useState([])

//   const format_cost = (c, precision) => {
//     c = c.toFixed(precision)
//     if (c == (0).toFixed(precision)) 
//       return "<$" + (Math.pow(10, -precision)).toFixed(precision);
//     return "$" + c;
//   }

//   const cost_estimate = (model, k_tokens, precision=2) => {
//     if (model.startsWith("text-davinci")) {
//       return `, Cost: ${format_cost(k_tokens * 0.02, precision)}`
//     } else if (model.startsWith("text-ada")) {
//       return `, Cost: ${format_cost(k_tokens * 0.0004, precision)}`
//     } else if (model.startsWith("text-babbage")) {
//       return `, Cost: ${format_cost(k_tokens * 0.0005, precision)}`
//     } else if (model.startsWith("text-curie")) {
//       return `, Cost: ${format_cost(k_tokens * 0.002, precision)}`
//     } else {
//       return ""
//     }
//   }

//   const extend_timeseries = (data) => {
//     const t = data._step
//     const newStats = stats.slice()
//     newStats.push(data)
//     setStats(newStats)
//   }

//   useEffect(() => {
//     LMQLProcess.on("render", {
//       add_result: (data) => {
//         if (data.type == "openai-token-count") {
//           extend_timeseries(data.data)
//         }
//       },
//       clear_results: () => setStats([])
//     })
//   })

//   if (stats.length > 0) {
//     const tokenCount = stats.map(s => s.tokens)
//     const model = stats[0].model
//     const otherKeys = Object.keys(stats[0]).filter(k => k != "tokens").filter(k => !k.startsWith("_"))
//     const otherData = otherKeys.map(k => {
//       return {
//         name: k,
//         data: stats.map(s => s[k])
//       }
//     })

//     let plots = [
//       {
//         x: Array.from(Array(tokenCount.length).keys()),
//         y: tokenCount,
//         type: 'scatter',
//         mode: 'lines+markers',
//         marker: {color: 'red'},
//       }
//     ]

//     return <PlotContainer style={props.style}>
//       <Plot 
//       data={plots} 
//       style={{flex: 1, padding: "10pt", borderRadius: "5pt"}}
//       className="plot"
//     />
//     </PlotContainer>
//   } else {
//     return <CenterBox style={props.style}><h2>No Statistics Available</h2></CenterBox>
//   }
// }

function EditorPanel(props) {
  props = Object.assign({
    onRun: () => { },
  }, props);

  props.status = props.processState
  props.processState = props.status.status

  const [editorRef, setEditorRef] = useState({ current: null });

  function handleEditorDidMount(editor, monaco) {
    if (editor) {
      setEditorRef({ current: editor });
    }

    ResizeObservers.addResizeListener(() => editor.layout({}))

    registerLmqlLanguage(monaco);
    import('./editor/theme.json')
      .then(data => {
        monaco.editor.defineTheme('solarized-dark', data);
        monaco.editor.setTheme('solarized-dark');
      })
    
    persistedState.on("lmql-editor-contents", (contents) => {
      if (editor.getValue() == contents) return;
      editor.setValue(contents)
    });
    
    editor.onDidChangeModelContent(() => {
      persistedState.setItem("lmql-editor-contents", editor.getValue())
    })
  }

  return (
    <Panel className='stretch max-width-50' id='editor-panel' style={{
      display: "flex",
    }}>
      <h2>Query</h2>
      <Editor
        defaultValue={persistedState.getItem("lmql-editor-contents") || ""}
        theme="vs-dark"
        // no minimap
        options={{
          // no minimap
          minimap: { enabled: false },
          // no line numbers
          lineNumbers: "off",
          // font size 14pt
          fontSize: 16,
          // line wrap
          wordWrap: "on",
          // tabs are spaces
          // tabSize: 6,
          // show whitespace
          renderWhitespace: "all",
          automaticLayout: true
        }}
        // custom language
        defaultLanguage="lmql"
        style={{ maxHeight: "80%" }}
        onMount={handleEditorDidMount}
      />
      <ButtonGroup>
        <FancyButton className='green' onClick={props.onRun} disabled={props.processState != "idle" && props.processState != "secret-missing"}>
          {props.processState == "running" ? <>Running...</> : <>&#x25B6; Run</>}
        </FancyButton>
        {/* load spinner svg */}
        <StopButton onClick={() => {
          LMQLProcess.kill()
        }} disabled={props.processState != "running"}>
          {/* utf8 stop square */}
          <i>&#x25A0;</i> Stop
        </StopButton>
        {/* status light for connection status */}
        <StatusLight connectionState={props.status} />
        {/* <Spacer></Spacer> */}
        <TokenCountIndicator />
      </ButtonGroup>
    </Panel>
  );
}

const Row = styled.div`
  display: flex;
  align-items: stretch;
  flex-direction: row;
  margin-bottom: 3pt;
  height: calc(50% - 20pt - 4pt);
`

const IconButton = styled.button`
  background-color: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  color: white;
  font-size: 0.8em;
  width: 28pt;
  height: 28pt;
  margin-top: 4pt;
  
  // hover highlight
  &:hover {
    background-color: #333;
  }

  /* checked state */
  &.checked {
    /* slightly darker thana bove */
    background-color: #444;
  }
  
  // click highlight
  &:active {
    background-color: #444;
  }

  // active
  &.active {
    background-color: #444;
  }

  border-radius: 5pt;
`

const TopBarIconButton = styled(IconButton)`
  background-color: transparent;
  color: #2a2929;
  width: auto;
  display: flex;
  align-items: center;
  flex-direction: row;
  padding-right: 9pt;
  padding-left: 9pt;
  margin: 4pt 3pt 4pt 0pt;

  svg {
    position: relative;
    top: 1pt;
  }

  :hover {
    background-color: #dcd9d9;
  }
`

const ToolbarIconButton = styled(IconButton)`
  padding: 0;
  padding-left: 4pt;
  padding-right: 4pt;
  margin-left: 5pt;
  border-radius: 2pt;
  width: auto;
  height: 14pt;

  > span {
    margin-left: 4pt;
  }

  &.checked > span, &.checkable > span {
    margin-left: 0pt;
  }

  > svg {
    position: relative;
    top: 0.5pt;
  }
`

function CheckableToolbarIconButton(props) {
  let p = Object.assign({
    checked: false,
    onClick: () => { },
  }, props);
  return <ToolbarIconButton className={p.checked ? "checked checkable" : "checkable"} onClick={p.onClick}>
    {p.checked ? <BsCheckSquare size={8} /> : <BsSquare size={8} />}
    <span className="spacer wide"> </span>
    {p.children}
  </ToolbarIconButton>
}

function OutputPanelContent(props) {
  const [output, setOutput] = useState("Client ready.\n");

  const onConsoleOut = data => {
    if (typeof data === 'string') {
      setOutput(s => s + data);
    } else {
      setOutput(s => s + JSON.stringify(data, null, 2));
    }
  };

  // on mount
  useEffect(() => LMQLProcess.addConsoleListener(onConsoleOut))
  // on unmount
  useEffect(() => () => LMQLProcess.remove("console", onConsoleOut))

  props.clearTrigger.addTriggerListener(() => {
    setOutput("");
  })

  props = Object.assign({}, props)
  props.style = Object.assign({
    fontSize: "8pt",
  }, props.style)

  return <>
    <OutputText style={props.style} readOnly={true} value={output}></OutputText>
  </>
}

const ModelResultText = styled.div`
  flex: 1; 
  display: flex;
  flex-direction: column;
  line-height: 1.6em;
  white-space: pre-wrap;
  overflow-y: auto;
  max-height: 100%;

  &::-webkit-scrollbar {
    width: 0px;
  }

  h3 {
    margin: 0;
    padding: 0;
    font-size: 12pt;
  }

  &:active div {
    background-color: rgba(255, 255, 255, 0.01);
  }

  span {
    padding: 1pt;
  }

  div {
    padding: 5pt;
    background-color: rgba(255, 255, 255, 0.02);
    border-radius: 2pt;
    flex:1;
    padding-bottom: 20pt;
  }

  div .prompt {
    opacity: 0.95;
  }
  
  &>div>span:first-child {
    margin-left: 0pt;
    padding-left: 0pt;
  }

  span.escape {
    color: #5c5c5c;
  }

  div .variable {
    color: white;
    background-color: #333;
    opacity: 1.0;
    border-radius: 2pt;
    margin-left: 1pt;
  }

  div .variable:hover {
    position: relative;
  }

  div .badge {
    padding: 2.5pt 4pt;
    border-radius: 2pt;
    font-size: 8pt;
    background-color: rgba(0, 0, 0, 0.5);
    position:relative; 
    top: -1.25pt;
    margin-right: 2pt;
    user-select: none;
    /* exclude from text selection */
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  div .badge:last-child {
    margin-right: 0;
  }

  div .variable.v8 { background-color: #6b77ff; }
  div .variable.v0 { background-color: #bc67ed; }
  div .variable.v7 { background-color: #f055cf; }
  div .variable.v2 { background-color: #ff4baa; }
  div .variable.v6 { background-color: #ff5482; }
  div .variable.v3 { background-color: #ff6c5b; }
  div .variable.v5 { background-color: #ff8935; }
  div .variable.v4 { background-color: #ffa600; }
  div .variable.v1 { background-color: #dca709; }
`

class Truncated extends React.Component {
  constructor(props) {
    super(props)
    
    this.state = {
      typingOffset: 0,
      expandedText: ""
    }
    this.stepper = null
  }

  componentDidMount() {
    this.stepper = setInterval(() => {
      this.setState(s => Object.assign(s, { typingOffset: s.typingOffset + 2 }))
    }, 20)
  }

  componentWillUnmount() {
    clearInterval(this.stepper)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.tokens != this.props.tokens) {
      let tokens = this.props.tokens
      let prevTokens = prevProps.tokens

      if (!tokens || !prevTokens) {
        this.setState({ typingOffset: 0 })
        return;
      }

      let commonPrefixOffset = 0

      for (let i = 0; i < Math.min(prevTokens.length, tokens.length); i++) {
        let c = tokens[i]
        let cPrev = prevTokens[i]
        
        let content = c.content
        let prevContent = cPrev.content

        if (content != prevContent) {
          let j = 0
          while (j < Math.min(content.length, prevContent.length) && content[j] == prevContent[j]) {
            j++
          }
          commonPrefixOffset += j
          break;
        } else {
          if (c.variable != "__prompt__") {
            commonPrefixOffset += content.length
          }
        }
      }
      this.setState({ typingOffset: commonPrefixOffset })
    }
  }

  renderVariableName(variable) {
    if (variable.endsWith("[0]")) {
      return variable.substr(0, variable.length - 3)
    }
    return variable
  }

  renderContent(content) {
    // make sure to render model output control characters
    content = content.replace(/\\n/g, "\n")
    content = content.replace(/\\t/g, "\t")

    let EXPLICIT_CHARS = {
      "\n": "⏎",
      "\t": "⇥",
    }

    let elements = []
    let text = ""
    let i = 0;
    for (let c of content) {
      if (EXPLICIT_CHARS[c]) {
        elements.push(<>{text}</>)
        elements.push(<span className="escape" key={"escape_" + i}>{EXPLICIT_CHARS[c]}</span>)
        text = c
      } else {
        text += c;
      }
      i++;
    }
    elements.push(<>{text}</>)
    return elements
  }

  render() {
    const tokens = this.props.tokens

    let elements = []
    let characterCount = 0

    for (let i = 0; i < tokens.length && (characterCount < this.state.typingOffset || !this.props.typing); i++) {
      let c = tokens[i]
      let content = c.content
      
      if (c.variable != "__prompt__") {
        characterCount += content.length
      }
      if (characterCount > this.state.typingOffset && this.props.typing) {
        content = content.substr(0, this.state.typingOffset - (characterCount - content.length))
      }

      // let escapedContent = this.renderContent(content)
      
      let segmentContent = <>
        {c.variable != "__prompt__" && <span key={i + "_badge-" + this.renderVariableName(c.variable)} className="badge">{this.renderVariableName(c.variable)}</span>}
        {c.content.length > 0 && <span key={i + "_content-" + c.content} className="content">
          {this.leftTruncated(i + "_content", content, i==0)}
        </span>}
      </>

      elements.push(<span key={i + "_segment-" + c.content} className={(c.variable != "__prompt__" ? "variable " : "") + c.variableClassName}>{segmentContent}</span>)
    }
    
    return <>{elements}</>
  }

  setExpandedText(text) {
    this.setState(s => ({
      expandedText: text
    }))
  }

  leftTruncated(key, content, truncate) {
    const length = 250

    if (!truncate) return this.renderContent(content)
    if (content.length < length) return this.renderContent(content)

    const text = content

    return <span key={key}>
      {this.state.expandedText == text && <>{this.renderContent(text)}</>}
      {this.state.expandedText != text && <>
        <ExpandButton className="clickable" onClick={() => this.setExpandedText(text)}>...</ExpandButton>
        {this.renderContent(text.substr(text.length - length))}
      </>}
    </span>
  }
}

const ExpandButton = styled.button`
  background-color: #675f5f;
  color: #d2c4c4;
  font-weight: bold;
  border: none;
  border-radius: 4pt;
  padding: 2pt;
  padding-left: 10pt;
  padding-right: 10pt;
  margin-right: 4pt;

  :hover {
    background-color: #9f9898;
    cursor: pointer;
  }
`

function ModelResultContent(props) {
  const scrollRef = useRef(null)

  // on changes to props.mostLikelyNode scroll down to end of scroll view
  useEffect(() => {
    if (props.trackMostLikly) {
      let scroll = scrollRef.current
      scroll.scrollTop = scroll.scrollHeight
    }
  }, [props.mostLikelyNode ? props.mostLikelyNode.data("id") : null, props.trackMostLikly])


  let modelResult = null;
  if (props.trackMostLikly) {
    modelResult = reconstructTaggedModelResult([props.mostLikelyNode])
  } else {
    modelResult = reconstructTaggedModelResult(props.selectedNodes);
  }

  let countedResults = []
  let variableCountIds = {}

  for (let r of modelResult) {
    let varCounter = 0;
    let result = []
    for (let segment of r.tokens) {
      // determine base variable name
      let baseVariableName = segment.variable
      if (segment.variable.endsWith("]")) {
        baseVariableName = segment.variable.substr(0, segment.variable.indexOf("["))
      }

      if (segment.variable == "__prompt__") {
        result.push({
          variableClassName: "prompt",
          variable: segment.variable,
          content: segment.content
        })
        continue;
      }

      let variableClassName = "v" + (varCounter % 8)
      if (baseVariableName in variableCountIds && props.perVariableColor) {
        variableClassName = "v" + (variableCountIds[baseVariableName] % 8)
      } else {
        variableCountIds[baseVariableName] = varCounter
        varCounter += 1;
      }

      result.push({
        variableClassName: variableClassName,
        variable: segment.variable,
        content: segment.content,
      })
    }
    countedResults.push({
      tokens: result,
      node: r.node
    });
  }

  const onDoubleClick = (event) => {
    // select all
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(event.target);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // sort countedResult by seqlogprob
  countedResults.sort((a, b) => {
    return b.node.data("seqlogprob") - a.node.data("seqlogprob")
  })

  const useTypingAnimation = countedResults.length == 1 && props.trackMostLikly;

  return <ModelResultText style={props.style} onDoubleClick={onDoubleClick} ref={scrollRef}>
    {countedResults.map((r, i) => {
      return <div key={"result" + i}>
        {countedResults.length > 1 && <h3>
          Result #{i}
          <span className='spacer wide' />
          <span className="variable">
            <span className="badge">seqlogprob</span>
            <span className='spacer' />
            {r.node.data("seqlogprob").toFixed(4)}
          </span>
        </h3>}
        <Truncated tokens={r.tokens} typing={useTypingAnimation}/>
      </div>
    })}
    {countedResults.length == 0 && <CenterBox>
      <h2>No Selection</h2>
      <span className="subtitle">Select a node in the Decoding Graph to see more details or <a onClick={() => trackingState.setTrackMostLikely(true)}>"Show Latest"</a>.</span>
    </CenterBox>}
  </ModelResultText>
}

const OutputText = styled.textarea`
  font-size: 9pt;
  font-family: monospace;
  background-color: #222;
  padding: 0;
`
const CompiledCodeEditorContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`


function CompiledCodePanelContent(props) {
  const [compiledCode, setCompiledCode] = useState("# Press Run to compile.");

  // on mount
  useEffect(() => {
    const renderer = {
      add_result: (data) => {
        if (data.type == "compiled-code") {
          setCompiledCode(data.data.code);
        } else {
          // nop in this component
        }
      },
      clear_results: () => setCompiledCode("Compiling..."),
    }
    
    LMQLProcess.addRenderer(renderer)
    return () => {
      LMQLProcess.remove("render", renderer)
    }
  }, []);

  const handleEditorDidMount = (editor, monaco) => {
    ResizeObservers.addResizeListener(() => editor.layout({}))
  }

  return <CompiledCodeEditorContainer {...props}>
    <Editor
      defaultValue={compiledCode}
      theme="vs-dark"
      value={compiledCode}
      // no minimap
      options={{
        // no minimap
        minimap: { enabled: false },
        lineNumbers: "on",
        fontSize: 10,
        readOnly: true,
        wordWrap: "on",
      }}
      defaultLanguage="python"
      onMount={handleEditorDidMount}
    />
  </CompiledCodeEditorContainer>
}

const CenterBox = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  text-align: center;
  height: 100%;

  & > h2 {
    margin: 0;
    font-size: 10pt;
    /* lighter than grey */
    color: #888;
    font-weight: normal;
    /* move up by line height */
    margin-top: -30pt;
  }
`

const CollapsiblePanelDiv = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: auto;
  flex: 1;

  h3 {
    display: block;
    padding: 5pt 2pt;
    margin: 5pt 0pt;
    cursor: pointer;
    user-select: none;
  }

  /* hover */
  h3:hover {
    background-color: #333;
  }

  > div {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
`

function CollapsiblePanel(props) {
  const [collapsed, setCollapsed] = useState(true);
  const [height, setHeight] = useState("auto");

  const toggle = () => {
    setCollapsed(!collapsed);
    setHeight(collapsed ? "auto" : "32pt");
  }

  return <CollapsiblePanelDiv style={{ height: height }}>
    <h3 onClick={toggle}>{collapsed ? "▶ " : "▼ "}{props.title}</h3>
    <div className="textview" style={{ display: collapsed ? "none" : "flex" }}>
      {props.children}
    </div>
  </CollapsiblePanelDiv>
}

function resolve(o, path) {
  if (Array.isArray(path)) {
    return path[1];
  }

  try {
    let segements = path.split(".");
    let value = o;
    for (let i = 0; i < segements.length; i++) {
      value = value[segements[i]];
    }
    return value;
  } catch (e) {
    return null
  }
}

function unpack(object, key) {
  if (key in object == false) {
    return object
  }
  if (object[key] == "None") {
    return object
  }

  let o = Object.assign({}, object)
  // delete key
  delete o[key]
  // top-level assign key
  o = Object.assign(o, object[key])
  return o
}

const squareSpan = styled.span`
  display: inline-block;
  width: 8pt;
  height: 8pt;
  margin-right: 5pt;
  border-radius: 2pt;
  position: relative;
  top: 1pt;
  left: 1pt;
`

const VarTrueSquare = styled(squareSpan)`
  background-color: #aaedaa;
`
const VarFalseSquare = styled(squareSpan)`
  background-color: #f09d9d;
`
const FinTrue = styled(squareSpan)`
  background-color: #67f467;
`
const FinFalse = styled(squareSpan)`
  background-color: #eb5943;
`

const ValidLink = styled.a`
  cursor: pointer;
  :hover {
    text-decoration: underline;
  }

  svg {
    position: relative;
    top: 1.5pt;
    margin-left: 3pt;
    margin-right: 3pt;
  }
`

function ValidText(props) {
  const valid = props.valid;
  const final = props.final;

  const squares = {
    "var(true)": <VarTrueSquare />,
    "var(false)": <VarFalseSquare />,
    "var(None)": <VarFalseSquare />,
    "fin(true)": <FinTrue />,
    "fin(false)": <FinFalse />
  }

  const s = `${final}(${valid})`
  const square = squares[s] ? squares[s] : <></>

  if (valid === null || final === null) {
    return <>n/a</>
  } else {
    return <ValidLink onClick={props.onOpenValidationGraph}>
      {square}
      {s}
      <BsArrowRightCircle size={12}/>
      </ValidLink>
  }
}

const ScrollingContent = styled.div`
  flex: 1;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 0pt !important }
  & { overflow: -moz-scrollbars-none; }
  & { -ms-overflow-style: none; }
`

function InspectorPanelContent(props) {
  let nodeInfo = unpack(props.nodeInfo, "user_data")
  nodeInfo = unpack(nodeInfo, "head")

  const valid = ["valid", <ValidText final={resolve(nodeInfo, "final")} valid={resolve(nodeInfo, "valid")} onOpenValidationGraph={props.onOpenValidationGraph}/>]

  const DECODER_KEYS = ["logprob", "seqlogprob", "pool"]
  const INTERPRETER_KEYS = ["variable", valid, "mask", "head_index"]
  const PROGRAM_VARIABLES = resolve(nodeInfo, "program_state") ? Object.keys(resolve(nodeInfo, "program_state"))
    .map(key => [key, resolve(nodeInfo, "program_state." + key)]) : []

  const KEYS_TO_FILTER = ["user_data", "parent", "layouted", "label", "id", "full_text", "program_state", "program_variables", "valid", "final", "text", "trace", "root", "seqtext", "where"]

  const decoderKeys = DECODER_KEYS.filter(key => typeof resolve(nodeInfo, key) !== "undefined")
  const interpreterKeys = INTERPRETER_KEYS.filter(key => typeof resolve(nodeInfo, key) !== "undefined")
  const keysFirst = decoderKeys.concat(interpreterKeys).concat(PROGRAM_VARIABLES)

  const keysRest = Object.keys(nodeInfo).filter(key => !keysFirst.includes(key) && !KEYS_TO_FILTER.includes(key) && !key.startsWith("_")).sort()

  const renderLine = (key) => {
    if (Array.isArray(key)) {
      return <tr key={key[0]}><td><h4>{key[0]}</h4></td><td className="value">{key[1]}</td></tr>
    }
    // if key is (key,value) pair then use key as label
    let value = resolve(nodeInfo, key)
    return <tr key={key}><td><h4>{key}</h4></td><td className="value">{"" + JSON.stringify(value)}</td></tr>
  }

  return <DataListView style={{ overflow: "auto", flex: 1, 
    position: "absolute",
    top: "30pt",
    left: "10pt",
    right: "40pt",
    bottom: "10pt"}}>
    <ScrollingContent>
      <table>
        <tbody>
          <tr className="header"><td><h3>Decoder</h3></td><td></td></tr>
          {decoderKeys.map(renderLine)}
          <tr className="header"><td><h3>Interpreter</h3></td><td></td></tr>
          {interpreterKeys.map(renderLine)}
          <tr className="header"><td><h3>Variables</h3></td><td></td></tr>
          {PROGRAM_VARIABLES.map(renderLine)}
          {PROGRAM_VARIABLES.length === 0 && <tr><td><h4>-</h4></td><td></td></tr>}
          {keysRest.length > 0 && <tr className="header"><td><h3>Misc</h3></td><td></td></tr>}
          {keysRest.map(renderLine)}
        </tbody>
      </table>
      <CollapsiblePanel title="Raw Data">
        <div disabled={true} style={{ resize: "none", flex: 1, minHeight: "120pt" }}>
          {JSON.stringify(props.nodeInfo, null, 2)}
        </div>
      </CollapsiblePanel>
    </ScrollingContent>
  </DataListView>
}

function InspectorPane(props) {
  const stretch = props.stretch ?? false;
  const defaultClass = stretch ? 'stretch' : '';
  const nodeInfo = props.nodeInfo && props.nodeInfo.text ? props.nodeInfo : null;

  const [activeTab, _setActiveTab] = useState("inspector");
  const visible = activeTab != null

  const setActiveTab = (tab) => {
    if (tab == activeTab) {
      _setActiveTab(null)
    } else {
      _setActiveTab(tab)
    }
  }

  const tabNames = {
    "inspector": "Inspector",
    "validation": "Validation Graph",
    null: "Inspector"
  }

  let where = null;
  if (props.nodeInfo && props.nodeInfo.user_data && props.nodeInfo.user_data.head) {
    where = props.nodeInfo.user_data.head.where
    // copy via JSON
    if (where) {
      where = JSON.parse(JSON.stringify(where))
    }
  }

  return (
    <Panel className={visible ? defaultClass + " with-sidebar" : 'hidden with-sidebar'} id="inspector">
      <h2>{tabNames[activeTab]}</h2>
      {activeTab == "inspector" && nodeInfo && <InspectorPanelContent nodeInfo={nodeInfo} onOpenValidationGraph={() => setActiveTab("validation")}/>}
      {activeTab == "inspector" && visible && nodeInfo == null && <CenterBox>
        <h2>No Selection</h2>
        <span className="subtitle">Select a node in the Decoding Graph to see more details.</span>
      </CenterBox>}
      <ValidationGraph style={{ 
        position: "absolute",
        top: "30pt",
        left: "10pt",
        right: "40pt",
        bottom: "10pt",
        visibility: activeTab == "validation" ? "visible" : "hidden"}} graph={where}/>
      <Sidebar>
        <IconButton
          onClick={() => setActiveTab("inspector")}
          className={activeTab == "inspector" ? 'active' : ''}>
          <BsCardList size={16} />
        </IconButton>
        <IconButton
          onClick={() => setActiveTab("validation")}
          className={activeTab == "validation" ? 'active' : ''}>
          <BsCheckSquare size={16} />
        </IconButton>
      </Sidebar>
    </Panel>
  );
}

function SidePanel(props) {
  const stretch = props.stretch ?? false;
  const defaultClass = stretch ? 'stretch' : '';
  const [clearTrigger, setClearTrigger] = useState(new TriggerState());
  const [clearOnRun, setClearOnRun] = useState(true);
  const [perVariableColor, setPerVariableColor] = useState(true);

  const [trackMostLikly, setTrackMostLiklyInternal] = useState(false)
  trackingState.setTrackMostLikely = setTrackMostLiklyInternal
  const setTrackMostLikly = (value) => {
    setTrackMostLiklyInternal(value)
    if (!value && props.mostLikelyNode) {
      trackingState.setSelectedNode(props.mostLikelyNode)
    }
  }

  const [sidepanel, setSidepanel] = useState("model");
  const setSidepanelTo = (panel) => {
    if (sidepanel === panel) {
      setSidepanel(null);
    } else {
      setSidepanel(panel);
    }
  }

  const visible = sidepanel != null;

  useEffect(() => {
    LMQLProcess.on('run', () => {
      if (clearOnRun) {
        clearTrigger.trigger();
      }
    })
  }, [])

  const titles = {
    "output": "Output",
    "code": "Compiled Code",
    "model": "Model Response",
    "stats": "Statistics"
  }

  return (
    <Panel className={visible ? defaultClass + " with-sidebar" : 'hidden with-sidebar'} id="sidepanel">
      <h2>
        {titles[sidepanel]}
        {sidepanel == 'output' && <>
          <ToolbarSpacer />
          <ToolbarIconButton onClick={() => clearTrigger.trigger()}>
            <BsXCircle size={8} />
            <span>Clear</span>
          </ToolbarIconButton>
          <ToolbarIconButton className={clearOnRun ? "checked checkable" : "checkable"} onClick={() => setClearOnRun(!clearOnRun)}>
            {clearOnRun ? "Clears on Run" : "Clear on Run"}
          </ToolbarIconButton>
        </>}
        {sidepanel == 'model' && <>
          <ToolbarSpacer />
          <CheckableToolbarIconButton checked={perVariableColor} onClick={() => setPerVariableColor(!perVariableColor)}>
            Repeated Variable Colors
          </CheckableToolbarIconButton>
          <CheckableToolbarIconButton checked={trackMostLikly} onClick={() => setTrackMostLikly(!trackMostLikly)}>
            Show Latest
          </CheckableToolbarIconButton>
        </>}
      </h2>
      <OutputPanelContent style={{ display: sidepanel === 'output' ? 'block' : 'none' }} clearTrigger={clearTrigger} />
      <CompiledCodePanelContent style={{ display: sidepanel === 'code' ? 'block' : 'none' }} />
      <ModelResultContent style={{ display: sidepanel === 'model' ? 'flex' : 'none' }}
        selectedNodes={props.selectedNodes}
        perVariableColor={perVariableColor}
        mostLikelyNode={props.mostLikelyNode}
        trackMostLikly={trackMostLikly}
        onTrackLatest={() => setTrackMostLikly(true)}
      />
      {/* <StatisticsPanelContent style={{display: sidepanel === 'stats' ? 'flex' : 'none'}}/> */}

      <Sidebar>
        <IconButton onClick={() => setSidepanelTo('model')} className={sidepanel === 'model' ? 'active' : ''}>
          <BsFillChatLeftTextFill size={16} />
        </IconButton>
        <IconButton
          onClick={() => setSidepanelTo('output')}
          className={sidepanel === 'output' ? 'active' : ''}>
          <BsTerminal size={16} />
        </IconButton>
        <IconButton onClick={() => setSidepanelTo('code')} className={sidepanel === 'code' ? 'active' : ''}>
          <BsFileCode size={16} />
        </IconButton>
        {/* <IconButton onClick={() => setSidepanelTo('stats')} className={sidepanel === 'stats' ? 'active' : ''}>
          <BsFileBarGraph size={16}/>
        </IconButton> */}
      </Sidebar>
    </Panel>
  );
}

const Toolbar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 0pt;
`

const ButtonGroup = styled.div`
  display: flex;
  background-color: ${bg};
  padding: 4pt;
  padding-left: 2pt;
  flex-direction: row;
  justify-content: flex-start;
  flex: 1;
  z-index: 1;
  
  /* position: absolute;
  bottom: 10pt;
  left: 10pt;
  width: calc(100% - 20pt); */
`

const FancyButton = styled.button`
  /* blue purpleish button gardient */
  background-color: #3d4370;
  border: 1pt solid #3d4370;
  padding: 5pt 10pt;
  border-radius: 3pt;
  font-weight: bold;
  color: white;

  :hover {
    border: 1pt solid #8e98ea;
    cursor: pointer;
  }

  &.green {
    background-color: #5db779;
    border-color: #5db779;

    :hover {
      border-color: #6cdb8f;
    }

    &:disabled {
      background-color: #5db77a31;
      border-color: transparent;
      color: #ffffff44;

      :hover {
        cursor: default;
        background-color: #5db77a31;
        border-color: transparent;
        color: #ffffff44;
      }
    }
  }
`

const ActionButton = styled.button`
  border: 1pt solid #39aa5d;
  /* border: none; */
  border-radius: 3pt;
  margin-right: 2pt;
  /* background-color: #5db779; */
  /* nice green gradient */
  background-image: linear-gradient(to bottom, #5db779, #39aa5d);
  cursor: pointer;
  color: white;
  font-size: 11pt;
  font-weight: bold;
  min-width: 60pt;;
  height: 28pt;
  padding: 5pt 15pt;
  height: 30pt;
  /* animate box shadow color */
  transition: box-shadow 0.1s ease-in-out;

  &.blue {
    border-color: #8e98ea;
    background-color: white;
    background: none;
    color: #3d4370;

    &:hover {
      background: none;
      background-color: #daddff;
    }
  }

  :last-child {
    margin-right: 0pt;
  }

  // hover highlight
  &:hover {
    // slightly darker than background
    background-image: linear-gradient(to bottom, #3db665, #2a9a4f);
  }

  // click highlight
  &:active {
    // slightly darker than hover
    background-image: linear-gradient(to bottom, #2a9a4f, #3db665);
  }

  &:disabled {
    /* much darker shade */
    opacity: 0.3;
  }

  &:hover:disabled {
    opacity: 0.3;
    cursor: default;
  }
`

// Action button derivative with red color
const StopButton = styled(FancyButton)`
  border-color: #ff0000;
  background: none;
  /* off red */
  background-color: transparent;
  display: inline;
  border: none;
  color: #c4c2c2;
  text-align: left;
  margin-left: 2pt;
  margin-right: 0;
  position: relative;
  bottom: 0.5pt;
  text-decoration: underline;
  padding: 4pt !important;

  // hover highlight
  &:hover {
    // slightly darker than background
    background: none;
    background-color: transparent;
    color:white;
    border: none;
  }

  // click highlight
  &:active {
    background: none;
    // slightly darker than hover
    background-color: transparent;
  }

  &:disabled {
    display: none;
  }

  &:hover:disabled {
    background-color: transparent;
    cursor: default;
    border: none;
  }

  i {
    position: relative;
    bottom: 1pt;
  }

  &.light {
    color: #404040;

    :hover {
      color: #404040;
    }
  }
`

const Spacer = styled.div`
  flex: 1;
`

const ToolbarSpacer = styled.div`
  flex: 1;
  display: inline;
`

const Token = styled.span`
  background-color: #333;
  display: inline-block;
  height: 2.2em;
  min-width: 1em;
  width: auto;
  padding-left: 0.5em;

  // vertically centered
  line-height: 2.2em;
  // render white space
  white-space: pre;

  border-radius: 5pt;
  margin-left: 0.5pt;

  // every other token, slightly darker
  &:nth-child(2n) {
    background-color: #444;
  }

  // make tokens fade in and move in from left
  animation: token-fade-in 0.2s ease-in-out;
  @keyframes token-fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`

const TokenStream = styled.div`
  display: block;
  position: relative;
  // do not wrap
  white-space: nowrap;
  
  overflow-x: auto;
  overflow-y: hidden;
  
  /* on hover show scrollbar */
  &:hover {
    &::-webkit-scrollbar {
      opacity: 1;
    }
  }

  // set scrollback background to bg
  &::-webkit-scrollbar {
    opacity: 0;
  }
`

const TokenStreamTitle = styled.h2`
  // always position at top left of container
  background-color: grey;
  border-radius: 5pt;
  display: block;
  margin: 0;
  padding: 0;
  line-height: 25pt;
  padding-right:4pt;
  margin-right: 4pt;
  padding-left: 4pt;
  font-size: 0.8em;
  text-align: left;
  height: 25pt;

  user-select: none;
  cursor: default;
`

const DecoderHeadDiv = styled.div`
  display: flex;
  flex-direction: row;
  margin: 10pt 0;
  position: relative;
`

const TokenStreamButton = styled.button`
  border: none;
  outline: none;
  cursor: pointer;
  color: white;
  background-color: #47CF73;
  font-size: 0.8em;
  position: absolute;
  top: 11.5pt;
  transform: translateY(-50%);

  right: 0;
  border-radius: 5pt;

  // hover highlight
  &:hover {
    background-color: #42bd69;
  }
  // click highlight
  &:active {
    background-color: #3db665;
  }
`

function animateScrollTo(target, element) {
  // animate html element scroll to target
  const scroll = element.scrollLeft;
  const delta = target - scroll;
  const duration = 500;
  const start = performance.now();

  // use random integer animation id
  let animationId = Math.floor(Math.random() * 1000000000);
  element.animationId = animationId;

  const step = (timestamp) => {
    const progress = (timestamp - start) / duration;
    element.scrollLeft = scroll + delta * progress;
    if (progress < 1 && element.animationId === animationId) {
      window.requestAnimationFrame(step);
    }
  }
  window.requestAnimationFrame(step);
}

function DecoderHead(props) {
  const ref = useRef(null);
  const [atEnd, setAtEnd] = useState(true);

  let tokenSequence = props.tokens.join('|');

  // on update of tokens or atEnd, scroll to end if atEnd
  useEffect(() => {
    if (atEnd) {
      let target = ref.current.scrollWidth;
      // animate scroll to end with react
      animateScrollTo(target, ref.current);
    }
  }, [tokenSequence]);

  const handleScroll = (event) => {
    // if at end, stay at end
    if (event.target.scrollLeft + event.target.clientWidth >= event.target.scrollWidth) {
      setAtEnd(true);
    } else {
      setAtEnd(false);
    }
  }

  const tokens = props.tokens
  return <DecoderHeadDiv>
    <TokenStreamTitle>JOKE</TokenStreamTitle>
    <TokenStream ref={ref} onScroll={handleScroll}>
      {tokens.map((token, i) => <Token key={i}>{token}</Token>)}
    </TokenStream>
    {atEnd ? null : <TokenStreamButton onClick={() => animateScrollTo(ref.current.scrollWidth, ref.current)}>Go to end &#x27A1; </TokenStreamButton>}
  </DecoderHeadDiv>
}

class TriggerState {
  constructor(listener = null) {
    this.listener = listener;
  }

  trigger() {
    if (this.listener) {
      this.listener(...arguments)
    }
  }

  addTriggerListener(listener) {
    this.listener = listener;
  }
}

function DecoderPanel(props) {
  const [fitTrigger, setFitTrigger] = useState(new TriggerState());
  const [eagerLayout, setEagerLayout] = useState(false);

  const derivedNodeFeatures = (data) => {
    return {
      "_finfalse": data.user_data && data.user_data.head && data.user_data.head.valid == "False",
      "_isRoot": data.root,
      "_isDone": data.user_data && data.user_data.head && data.user_data.head.variable == "__done__"
    }
  }

  return <Panel className='stretch' id="decoder">
    <h2>
      Decoder Graph
      <ToolbarSpacer />
      <ToolbarIconButton onClick={() => fitTrigger.trigger()}>
        <BsFullscreen size={8} />
        <span>Fit</span>
      </ToolbarIconButton>
      <ToolbarIconButton className={eagerLayout ? "checked checkable" : "checkable"} onClick={() => setEagerLayout(!eagerLayout)}>
        {eagerLayout ? <BsCheckSquare size={8} /> : <BsSquare size={8} />}
        <span className="spacer wide"> </span>
        Eager Layouting
      </ToolbarIconButton>
    </h2>
    <DecoderGraph 
      fitTrigger={fitTrigger} 
      onSelectNode={props.onSelectNode} 
      eagerLayout={eagerLayout}
      onMostLiklyNode={props.onMostLiklyNode} 
      derivedNodeFeatures={derivedNodeFeatures}
      selectedNodeTrigger={props.selectedNodeTrigger}
    />
  </Panel>
}

const StatusCircle = styled.div`
  width: 5pt;
  height: 5pt;
  border-radius: 2.5pt;
  background-color: #47CF73;
  margin-right: 5pt;

  &.pulsing {
    animation: pulsing 1s infinite alternate;
  }

  /* pulsing animation */
  @keyframes pulsing {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`

const StatusLightContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  font-size: 8pt;
  margin-top: 0pt;
  margin-left: 10pt;
`

function StatusLight(props) {
  let [firstStartup, setFirstStartup] = useState(true);

  props = Object.assign({
    connected: false,
    label: 'Disconnected',
  }, props.connectionState);

  const toFirstUpper = k => k.charAt(0).toUpperCase() + k.slice(1)

  let label = props.status || props.label;
  if (label == "idle" || label == "secret-missing") {
    label = "Ready"
    props.connected = true
    if (firstStartup) {
      setFirstStartup(false);
    }
  } else if (label == "running") {
    label = "Running"
    props.connected = true
  } else if (label == "stopping") {
    label = "Stopping..."
    props.connected = true
  } else if (label == "init") {
    if (!firstStartup) {
      label = "Reloading " + (props.error ? props.error : "") + "..."
    } else {
      label = "Loading " + (props.error ? props.error : "") + "..."
    }
  }

  let statusColor = props.connected ? '#5db779' : '#a0a0a0';

  return <StatusLightContainer>
    <div className='status-light'></div>
    {label != "" && <StatusCircle style={{ backgroundColor: statusColor }} className={!props.connected ? "pulsing" : ""} />}
    <span style={{ color: statusColor, marginRight: "10pt" }}>{label}</span>
  </StatusLightContainer>
}

const DEFAULT_DATA = {

}

const Commit = styled.div`
  margin-left: 5pt;
  text-align: right;
  font-size: 8pt;
  color: #4c4b4b;
  margin-right: 10pt;

  span {
    color: #4a4a4a;
    opacity: 0.0;
    margin-right: 2pt;
  }

  :hover span { 
    opacity: 1.0;
  }
`

const ToggleButton = styled.button`
  border: none;
  background-color: ${props => props.toggled ? "#00000022" : "transparent"};
  padding: 5pt 7pt;
  border-radius: 4pt;

  :hover {
    background-color: #0000002E;
  }
`

const OpenAICredentialsState = {
  open: false,
  listeners: [],
  setOpen: function (open) {
    OpenAICredentialsState.open = open;
    this.listeners.forEach((listener) => listener(open));
  }
}


const Explainer = styled.span`
  font-size: 12pt;
  color: #424242;


  a {
    color: #424242;
    text-decoration: underline;
    outline: none;

    :visited {
      color: #424242;
    }
  }

  form {
    margin-top: 20pt;
    margin-bottom: 20pt;
  }
`

function OpenAICredentials() {
  const [open, setOpen] = useState(OpenAICredentialsState.open);
  OpenAICredentialsState.listeners.push(setOpen);
  const [secret, setSecret] = useState(window.localStorage.getItem("openai-secret") || "");

  useEffect(() => {
    const onStatus= s => {
      if (s.status == "secret-missing") {
        OpenAICredentialsState.setOpen(true);
      }
    }
    LMQLProcess.on("status", onStatus);
    return () => {
      LMQLProcess.remove("status", onStatus);
    }
  }, []);

  if (!open) {
    return null;
  }

  const onSave = (e) => {
    LMQLProcess.setSecret(secret);
    OpenAICredentialsState.setOpen(false);
  }

  const onCancel = (e) => {
    OpenAICredentialsState.setOpen(false);
  }

  return <PromptPopup>
    <div className="click-handler" onClick={() => OpenAICredentialsState.setOpen(false)}/>
    <Dialog>
      <h1>OpenAI Credentials</h1>
      <Explainer>
        <p>
          To run your own queries in the LMQL playground, you have to provide your OpenAI API key. The key will only be stored in your browser's <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage" target="_blank">local storage</a>. You can find your API key in the <a href="https://beta.openai.com/account/api-keys" target="_blank">OpenAI dashboard</a>.<br />
        </p>
        <p className='note'>
          <b>Note:</b> LMQL will use your API key to execute completion requests on your behalf. This will result in charges on your OpenAI account. Please make sure you understand the <a href="https://beta.openai.com/pricing" target="_blank">OpenAI pricing model</a> before using LMQL. <i>LMQL does not take responsibility for any charges incurred by executing queries on this site.</i>
        </p>
        <form onSubmit={onSave}>
          <label>OpenAI API Secret</label><br />
          <input type="password" placeholder="API Secret" id="openai-api-key" onChange={(e) => setSecret(e.target.value)} value={secret} />
          {secret.length > 0 && <button onClick={(e) => { e.preventDefault(); setSecret("") }}>Clear</button>}
        </form>
      </Explainer>
      <div>
        <FancyButton className='blue' onClick={onSave}>
          <span>Save</span>
        </FancyButton>
        <StopButton className="light" onClick={onCancel}>
          Cancel
        </StopButton>
      </div>

    </Dialog>
  </PromptPopup>
}

const TopBarMenu = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  position: absolute;
  display: none;
  z-index: 100;
  top: 32pt;
  right: 0pt;
  width: 150pt;
  height: auto;
  background-color: white;
  border-radius: 4pt;
  border: 0.4pt solid grey;

  box-shadow: 0 0 10pt 0 #a2a1a11b;

  &.visible {
    display: block;
  }

  li a {
    text-decoration: none;
    color: black;
    display: block;

    :visited {
      color: black;
    }
  }

  li, >span {
    height: 15pt;
    line-height: 15pt;
    text-align: left;
    padding: 4pt;
    padding-left: 8pt;
    cursor: pointer;

    :hover {
      background-color: #00000022;
    }
  }

  li svg {
    position: relative;
    top: 1pt;
    margin-right: 2pt;
  }

  li a svg {
    margin-right: 5pt;
  }

  >span {
    color: #acacac;
    display: block;
    height: auto;
    font-size: 8pt;
    cursor: default;
    text-align: center;
    padding-right: 8pt;
    line-height: 1.2em;
    border-top: 0.4pt solid #dedddd;

    :hover {
      background-color: transparent;
    }
  }
`

// App as class component
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedNodeInfo: null,
      selectedNode: null,
      selectedNodes: null,

      mostLikelyNode: null,
      selectedNodeTrigger: new TriggerState(),

      buildInfo: BUILD_INFO.info(),
      status: LMQLProcess.status,
      processState: "init",
      graphLayout: false,
      topMenuOpen: false
    }
  }

  setSelectedNodeInfo(selectedNodeInfo) {
    if (!selectedNodeInfo) {
      this.setState({ selectedNodeInfo: null });
      return;
    }
    this.setState({ selectedNodeInfo: selectedNodeInfo });
  }

  setTopMenuOpen = (open) => {
    this.setState({ topMenuOpen: open });
  }

  setSelectedNode(selectedNode) {
    if (!selectedNode) {
      this.setState({ selectedNode: null });
      return;
    }
    this.setState({ selectedNode });
  }

  setSelectedNodes = (selectedNodes) => {
    if (!selectedNodes) {
      this.setState({ selectedNodes: null });
      return;
    }
    this.setState(state => Object.assign({}, state, {
      selectedNodes: selectedNodes(state.selectedNodes)
    }))
  }

  setMostLikelyNode = (mostLikelyNode) => {
    this.setState({ mostLikelyNode });
  }

  setBuildInfo(buildInfo) {
    this.setState({ buildInfo });
  }

  setStatus = (status) => {
    this.setState({ status });
  }

  setProcessState = (processState) => {
    this.setState({ processState });
  }

  setGraphLayout(graphLayout) {
    this.setState({ graphLayout });
    ResizeObservers.notify();
  }

  // conform to renderer interface
  add_result(r) {}

  clear_results() {
    this.setSelectedNodeInfo(null)
    this.setSelectedNode(null)
    this.setMostLikelyNode(null)
    this.setSelectedNodes(null)
  }

  onStatus(event) {
    if (event.status == "running" || event.status == "error") {
      this.setProcessState("running")
    } else {
      this.setProcessState("idle")
    }
  }

  componentDidMount() {
    LMQLProcess.addConsoleListener(console.log)
    LMQLProcess.on("status", s => this.setStatus(s))
    LMQLProcess.addRenderer(this)
    LMQLProcess.addStatusListener(this.onStatus.bind(this))

    BUILD_INFO.addListener(this.setBuildInfo.bind(this))
  }

  componentWillUnmount() {
    LMQLProcess.remove("render", this)
    LMQLProcess.remove("status", this.onStatus.bind(this))
  }

  onExportState() {
    let graphData = persistedState.dump()
    let dataUrl = "data:text/json;charset=utf-8," + encodeURIComponent(graphData)
    // trigger download of data
    let a = document.createElement('a');
    a.setAttribute("href", dataUrl);
    a.setAttribute("download", "lmql-state.json");
    a.click();
  }

  onRun() {
    const code = persistedState.getItem("lmql-editor-contents");
    const appData = {
      "name": "lmql",
      // monaco get editor content
      "app_input": code,
      "app_arguments": {}
    };

    LMQLProcess.run(appData);
  }

  onSelectNode(node, additive = false) {
    trackingState.setTrackMostLikely(false)

    this.setSelectedNode(node);
    this.setSelectedNodeInfo(node ? node.data() : null);

    this.setSelectedNodes((n) => {
      if (n == null) {
        return [node]
      } else if (additive) { // additive && n != null
        if (!n.includes(node)) {
          return [...n, node]
        } else {
          return n
        }
      } else {
        return [node]
      }
    })
  };

  onMostLiklyNode(node) {
    if (node == null) { return }
    this.setMostLikelyNode(node)
  };

  render() {
    trackingState.setSelectedNode = n => {
      this.onSelectNode(n)
      this.state.selectedNodeTrigger.trigger(n)
    };

    return (
      <ContentContainer className={this.state.graphLayout ? 'graph-layout' : ''}>
        <Toolbar>
          <Title>
            <img src="/lmql.svg" alt="LMQL Logo"/>  
            LMQL Playground
          </Title>
          {configuration.DEMO_MODE && <FancyButton onClick={() => ExploreState.setVisibility(true)}><ExploreIc /> Explore LMQL</FancyButton>}
          <Spacer />
          {/* show tooltip with build time */}
          {/* trigger button */}
          <ToggleButton onClick={() => this.setGraphLayout(!this.state.graphLayout)} toggled={this.state.graphLayout}>
            <BsLayoutWtf size={14} />
          </ToggleButton>
          {/* settings button */}
          <Commit>{this.state.buildInfo.commit}</Commit>
          <ToggleButton onClick={() => this.setTopMenuOpen(!this.state.topMenuOpen)} toggled={this.state.topMenuOpen}>
            <BsGear size={14} />
            <TopBarMenu className={this.state.topMenuOpen ? 'visible' : ''}>
              {configuration.BROWSER_MODE && <li onClick={() => OpenAICredentialsState.setOpen(true)}>
              <BsKeyFill/> OpenAI Credentials
              </li>}
              {configuration.DEV_MODE && <li onClick={() => this.onExportState()}><BsFileArrowDownFill/> Export State
              </li>}
              <LMQLInstanceSwitch/>
              <li>
                <a href="anonymized" disabled target="_blank"><BsGithub/>LMQL on Github</a>
              </li>
              <span>
                LMQL {this.state.buildInfo.commit} 
                {(configuration.BROWSER_MODE && !isLocalMode()) && <> In-Browser</>}
                {isLocalMode() && <> Self-Hosted</>}
                <br/>
                Build on {this.state.buildInfo.date}
              </span>
            </TopBarMenu>
          </ToggleButton>
        </Toolbar>
        <Row>
          <EditorPanel onRun={this.onRun.bind(this)} processState={this.state.status} connectionState={this.state.status} />
          <SidePanel selectedNodeInfo={this.state.selectedNodeInfo} selectedNode={this.state.selectedNode} selectedNodes={this.state.selectedNodes} mostLikelyNode={this.state.mostLikelyNode} />
        </Row>
        <Row style={{ flex: 1 }}>
          <DecoderPanel onSelectNode={this.onSelectNode.bind(this)} onMostLiklyNode={this.onMostLiklyNode.bind(this)} selectedNodeTrigger={this.state.selectedNodeTrigger} />
          <InspectorPane nodeInfo={this.state.selectedNodeInfo}></InspectorPane>
        </Row>
        <OpenAICredentials />
        {configuration.DEMO_MODE && <Explore />}
      </ContentContainer>
    );
  }
}

function LMQLInstanceSwitch() {
  if (!isLocalModeCapable()) {
    return null;
  }
  
  return <li onClick={() => setLMQLDistribution(isLocalMode() ? "remote" : "browser")}>
    {!isLocalMode() && <><BsFillHddNetworkFill/> Use self-hosted LMQL</>}
    {isLocalMode() && <><BsFillHddNetworkFill/> Use In-Browser LMQL</>}
  </li>
}


export default App;
