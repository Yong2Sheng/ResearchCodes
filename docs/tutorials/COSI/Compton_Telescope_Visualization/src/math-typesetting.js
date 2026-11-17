import katex from 'katex';
export function mathHTML(tex,displayMode=false){return katex.renderToString(tex,{displayMode,throwOnError:true,strict:'ignore',output:'htmlAndMathml'})}
const greek={'ϕ':'\\varphi','φ':'\\varphi','χ':'\\chi','ψ':'\\psi','ρ':'\\rho','β':'\\beta','μ':'\\mu','θ':'\\theta'};
const subs={'₀':'0','₁':'1','₂':'2','ₐ':'a','ₖ':'k','ₑ':'e'};
export function variableTeX(value){if(/a\s*=\s*−k/.test(value))return '\\boldsymbol{a}=-\\boldsymbol{k}';let result='';for(const ch of value){if(greek[ch])result+=greek[ch];else if(subs[ch])result+='_{'+subs[ch]+'}';else if(ch==='′')result+='^{\\prime}';else result+=ch}return result}
/** Typeset explicit equations and scientific symbols, leaving prose in the UI font. */
export function typesetMath(root=document.body){
 root.querySelectorAll('[data-tex]').forEach(el=>{if(el.dataset.renderedTex!==el.dataset.tex){el.innerHTML=mathHTML(el.dataset.tex,el.dataset.display==='true');el.dataset.renderedTex=el.dataset.tex}});
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){if(!node.textContent.trim()||node.parentElement?.closest('.katex,math,script,style,select,textarea,[data-tex]'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT}}),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 const expression=/a\s*=\s*−k|[ϕφχψρβμθ][₀₁₂ₐₖₑ]*|(?<![A-Za-z])[EramksxyzOS][₀₁₂ₐₖₑ′]*(?![A-Za-z])/g;
 for(const node of nodes){const value=node.textContent,matches=[...value.matchAll(expression)];const mathematical=matches.filter(match=>/[ϕφχψρβμθ₀₁₂ₐₖₑ′]/.test(match[0])||/a\s*=\s*−k/.test(match[0])||node.parentElement?.closest('[data-math-text]'));if(!mathematical.length)continue;const fragment=document.createDocumentFragment();let last=0;for(const match of mathematical){fragment.append(document.createTextNode(value.slice(last,match.index)));const span=document.createElement('span');span.className='math-inline';span.innerHTML=mathHTML(variableTeX(match[0]));fragment.append(span);last=match.index+match[0].length}fragment.append(document.createTextNode(value.slice(last)));node.replaceWith(fragment)}
}
