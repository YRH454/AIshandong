/* A tiny, dependency-free math normalizer for the Canvas explainer.
 * React surfaces use KaTeX; the original explainer draws to Canvas, so it
 * cannot host HTML. This keeps Canvas labels readable and guarantees that a
 * failed/generated TeX fragment never leaks raw backslashes onto the stage. */
(function(){
	"use strict";

	var commands = {
		alpha:"α", beta:"β", gamma:"γ", delta:"δ", theta:"θ", lambda:"λ", mu:"μ", sigma:"σ",
		rho:"ρ", phi:"φ", omega:"ω", pi:"π", nabla:"∇", partial:"∂", infty:"∞",
		cdot:"·", times:"×", pm:"±", neq:"≠", leq:"≤", geq:"≥", approx:"≈",
		to:"→", rightarrow:"→", leftarrow:"←", sum:"Σ", prod:"Π", int:"∫"
	};
	var superscripts = {"0":"⁰", "1":"¹", "2":"²", "3":"³", "4":"⁴", "5":"⁵", "6":"⁶", "7":"⁷", "8":"⁸", "9":"⁹", "+":"⁺", "-":"⁻"};
	var subscripts = {"0":"₀", "1":"₁", "2":"₂", "3":"₃", "4":"₄", "5":"₅", "6":"₆", "7":"₇", "8":"₈", "9":"₉", "+":"₊", "-":"₋"};

	function stripDelimiters(value){
		var text = String(value || "").trim();
		if(text.slice(0,2)==="$$" && text.slice(-2)==="$$") return text.slice(2,-2).trim();
		if(text.charAt(0)==="$" && text.charAt(text.length-1)==="$") return text.slice(1,-1).trim();
		if(text.slice(0,2)==="\\[" && text.slice(-2)==="\\]") return text.slice(2,-2).trim();
		if(text.slice(0,2)==="\\(" && text.slice(-2)==="\\)") return text.slice(2,-2).trim();
		return text;
	}
	function groupToText(value){
		return String(value || "").replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g,"$1");
	}
	function toReadable(value){
		var result = stripDelimiters(value);
		for(var pass=0; pass<5; pass++){
			result = result.replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,"($1)/($2)");
			result = groupToText(result);
			result = result.replace(/\\(?:hat|bar|vec|overline|underline)\s*\{([^{}]*)\}/g,"$1");
		}
		result = result.replace(/\\left|\\right/g,"");
		result = result.replace(/\\([A-Za-z]+)/g,function(_, command){ return commands[command] || command; });
		result = result.replace(/\^\{([^{}]+)\}/g,function(_, value){
			return String(value).split("").map(function(character){ return superscripts[character] || character; }).join("");
		});
		result = result.replace(/_\{([^{}]+)\}/g,function(_, value){
			return String(value).split("").map(function(character){ return subscripts[character] || character; }).join("");
		});
		result = result.replace(/\^([0-9+-])/g,function(_, character){ return superscripts[character] || character; });
		result = result.replace(/_([0-9+-])/g,function(_, character){ return subscripts[character] || character; });
		result = result.replace(/[{}]/g,"").replace(/\s+/g," ").trim();
		return result;
	}

	window.RHYME_MATH = { readable: toReadable };
})();

