/*
 * RHYME stage focus
 *
 * The original explorable keeps prose, buttons and the simulation on the same
 * 960 × 540 plane. That is charming for a short story, but generated lessons
 * can turn it into a wall of competing labels. This small stage director gives
 * semantic scenes one stable caption, one contextual action and one optional
 * atom inspector, leaving the drawing as the main event.
 */
(function(){
	"use strict";

	var activeSceneID = null;
	var activeScene = null;
	var nextSource = null;
	var caption = null;
	var captionText = null;
	var focus = null;
	var focusTitle = null;
	var focusRole = null;
	var focusDetail = null;
	var nextButton = null;

	function compactText(value, limit){
		var text = String(value || "").replace(/\s+/g, " ").trim();
		if(!text) return "";
		if(limit && text.length>limit) return text.slice(0, Math.max(1, limit-1)).replace(/[，、；;：: ]+$/, "") + "…";
		return text;
	}

	function getContainer(){
		return document.getElementById("container");
	}

	function getScene(sceneID){
		if(!sceneID || !window.RHYME_KNOWLEDGE_ATOMS) return null;
		return window.RHYME_KNOWLEDGE_ATOMS.getScene(sceneID);
	}

	function ensureStage(){
		var container = getContainer();
		if(!container) return;

		if(!caption){
			caption = document.createElement("aside");
			caption.id = "rhyme_stage_caption";
			caption.setAttribute("aria-live", "polite");
			captionText = document.createElement("strong");
			var captionHint = document.createElement("span");
			captionHint.textContent = "点击一个知识原子，查看它如何参与这一步。";
			caption.appendChild(captionText);
			caption.appendChild(captionHint);
			container.appendChild(caption);
		}

		if(!focus){
			focus = document.createElement("aside");
			focus.id = "rhyme_stage_focus";
			focus.hidden = true;
			focus.setAttribute("aria-live", "polite");
			focusTitle = document.createElement("strong");
			focusRole = document.createElement("span");
			focusDetail = document.createElement("p");
			focus.appendChild(focusTitle);
			focus.appendChild(focusRole);
			focus.appendChild(focusDetail);
			container.appendChild(focus);
		}

		if(!nextButton){
			nextButton = document.createElement("button");
			nextButton.id = "rhyme_stage_next";
			nextButton.type = "button";
			nextButton.hidden = true;
			nextButton.addEventListener("click", function(){
				if(nextSource) nextSource.click();
			});
			container.appendChild(nextButton);
		}
	}

	function activate(sceneID){
		activeSceneID = sceneID || null;
		activeScene = getScene(activeSceneID);
		if(!activeSceneID) return deactivate();
		ensureStage();

		var container = getContainer();
		if(container){
			container.setAttribute("data-rhyme-stage", "semantic");
			container.setAttribute("data-rhyme-scene", activeSceneID);
		}
		if(captionText){
			captionText.textContent = compactText(
				(activeScene && activeScene.caption) || "沿着画面中的关系，找到这一幕的关键判断。",
				58
			);
		}
		if(caption) caption.hidden = false;
		clearFocus();
	}

	function deactivate(){
		activeSceneID = null;
		activeScene = null;
		nextSource = null;
		var container = getContainer();
		if(container){
			container.removeAttribute("data-rhyme-stage");
			container.removeAttribute("data-rhyme-scene");
		}
		if(caption) caption.hidden = true;
		if(focus) focus.hidden = true;
		if(nextButton) nextButton.hidden = true;
	}

	function clearAction(){
		nextSource = null;
		if(nextButton){
			nextButton.hidden = true;
			nextButton.textContent = "";
		}
	}

	function trackBox(box){
		if(!activeSceneID || !box || box.classList.contains("sim_ui")) return;
		if(box.textContent && box.textContent.trim()) box.classList.add("rhyme-stage-copy");
		// Some inherited slides create their “next” button up front and reveal it
		// only after the learner completes the interaction. Do not surface that
		// action early in the semantic stage.
		if(box.style.display==="none") return;
		var originalNext = box.querySelector(".next_button");
		if(!originalNext) return;
		ensureStage();
		nextSource = originalNext;
		nextButton.textContent = compactText(originalNext.textContent, 28) || "继续";
		nextButton.hidden = false;
	}

	function focusAtom(knowledge, stateLabel){
		if(!activeSceneID || !knowledge) return;
		ensureStage();
		focusTitle.textContent = compactText(knowledge.label || "知识原子", 24);
		focusRole.textContent = compactText(stateLabel || knowledge.role || "知识点", 24);
		focusDetail.textContent = compactText(knowledge.detail || "这个知识原子正在与其他线索建立关系。", 104);
		focus.hidden = false;
		if(caption) caption.classList.add("is-minimized");
	}

	function clearFocus(){
		if(focus) focus.hidden = true;
		if(caption) caption.classList.remove("is-minimized");
	}

	window.RHYME_STAGE = {
		activate:activate,
		deactivate:deactivate,
		clearAction:clearAction,
		trackBox:trackBox,
		focusAtom:focusAtom,
		clearFocus:clearFocus,
		isActive:function(){ return !!activeSceneID; }
	};
})();
