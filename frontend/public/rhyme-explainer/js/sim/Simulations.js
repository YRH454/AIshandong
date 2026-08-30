/******************************

An interactive game in the BACKGROUND of the Slideshow...
(if fullscreen, origin is top-left of slideshow)
(if not, allow MULTIPLE canvasses & games.)

******************************/

function Simulations(){

	var self = this;
	self.dom = $("#simulations");

	self.sims = [];

	// Clear All Sims
	self.clear = function(){
		
		Simulations.IS_RUNNING = false;
		$("#container").removeAttribute("sim_is_running");

		self.sims.forEach(function(sim){
			self.dom.removeChild(sim.canvas);
			sim.kill();
		});
		self.sims = [];
		
	};

	// Add Sims
	self.add = function(config){
		config = cloneObject(config);
		config.container = self;
		var sim = new Sim(config);
		self.dom.appendChild(sim.canvas);
		self.sims.push(sim);
	};

	// Update
	self.update = function(){

		// Running sims... the CLOCK!
		if(Simulations.IS_RUNNING){
			if(self.CLOCK==0){

				// Step all sims!
				self.sims.forEach(function(sim){
					sim.nextStep();
				});
				self.CLOCK = 30; //25;

			}
			self.CLOCK--;
		}

		// Update all sims
		self.sims.forEach(function(sim){
			sim.update();
		});

	};

	// Draw
	self.draw = function(){
		self.sims.forEach(function(sim){
			sim.draw();
		});
	};

	////////////////////////
	// SIMULATION RUNNING //
	////////////////////////

	self.CLOCK = -1;
	subscribe("sim/start", function(){

		Simulations.IS_RUNNING = true;
		$("#container").setAttribute("sim_is_running",true);
		
		self.CLOCK = 0;
		// save for later resetting
		self.sims.forEach(function(sim){
			sim.save();
			if(sim.restartKnowledgeCallouts) sim.restartKnowledgeCallouts();
		});

	});
	subscribe("sim/stop", function(){
		
		Simulations.IS_RUNNING = false;
		$("#container").removeAttribute("sim_is_running");
		
		// reload the network pre-sim
		self.sims.forEach(function(sim){
			sim.reload(); 
		});

	});

	///////////////////////
	// HELPERS AND STUFF //
	///////////////////////

	// Get Child!
	self.getChildByID = function(id){
		return self.sims.find(function(sim){
			return sim.id==id;
		});
	};

}

// On resize, adjust the fullscreen sim (if any).
window.addEventListener("resize", function(){
	if(slideshow.simulations.sims.length>0){
		slideshow.simulations.sims[0].resize();
	}
}, false);

function Sim(config){

	var self = this;
	self.config = config;
	self.networkConfig = cloneObject(config.network);
	self.container = config.container;
	self.options = config.options || {};
	self.semanticSceneID = config.semanticScene || null;
	self.focusedPeep = null;
	self.focusedConnection = null;
	self.knowledgeFocusTick = 0;
	// Semantic scenes use the full sheet as a labelled knowledge network. Every
	// peep receives one distant card; the live network stays in the middle while
	// leaders route through the surrounding whitespace.
	self.knowledgeCallouts = [];
	self.knowledgeCalloutTick = 0;

	self.id = config.id;

	// A semantic scene is optional. Existing crowds scenes still work exactly as
	// before; RHYME scenes can give selected peeps names, roles and relationship
	// labels without changing the simulation's editing mechanics.
	self.getKnowledgeScene = function(){
		if(!self.semanticSceneID) return null;
		if(!window.RHYME_KNOWLEDGE_ATOMS) return null;
		return window.RHYME_KNOWLEDGE_ATOMS.getScene(self.semanticSceneID);
	};
	self.getKnowledgeRelationship = function(fromIndex, toIndex){
		var scene = self.getKnowledgeScene();
		if(!scene || !scene.relations) return null;
		var exact = scene.relations[fromIndex+"-"+toIndex];
		if(exact) return exact;
		var fallbackRelations = scene.fallbackRelations || [];
		if(fallbackRelations.length===0) return null;
		return fallbackRelations[Math.abs((fromIndex*17)+toIndex)%fallbackRelations.length];
	};
	function _readableKnowledgeText(value){
		var text = String(value || "");
		return window.RHYME_MATH && window.RHYME_MATH.readable
			? window.RHYME_MATH.readable(text)
			: text.replace(/\\([A-Za-z]+)/g, "$1");
	}
	function _compactKnowledgeText(value, limit){
		var text = _readableKnowledgeText(value).replace(/\s+/g, " ").trim();
		if(!text) return "";
		if(limit && text.length>limit){
			return text.slice(0, Math.max(1, limit-1)).replace(/[，、；;：: ]+$/, "") + "…";
		}
		return text;
	}
	function _knowledgeLines(value, charactersPerLine, maxLines){
		var text = _compactKnowledgeText(value, charactersPerLine*maxLines+8);
		if(!text) return [];
		var lines = [];
		while(text.length && lines.length<maxLines){
			var line = text.slice(0, charactersPerLine);
			text = text.slice(charactersPerLine);
			if(text && lines.length===maxLines-1){
				line = line.slice(0, Math.max(1, charactersPerLine-1)).replace(/[，、；;：: ]+$/, "") + "…";
				text = "";
			}
			lines.push(line);
		}
		return lines;
	}
	function _roundKnowledgeRect(ctx, x, y, width, height, radius){
		var r = Math.min(radius, width/2, height/2);
		ctx.beginPath();
		ctx.moveTo(x+r, y);
		ctx.lineTo(x+width-r, y);
		ctx.quadraticCurveTo(x+width, y, x+width, y+r);
		ctx.lineTo(x+width, y+height-r);
		ctx.quadraticCurveTo(x+width, y+height, x+width-r, y+height);
		ctx.lineTo(x+r, y+height);
		ctx.quadraticCurveTo(x, y+height, x, y+height-r);
		ctx.lineTo(x, y+r);
		ctx.quadraticCurveTo(x, y, x+r, y);
		ctx.closePath();
	}
	function _knowledgeStateColor(peep){
		var colors = {
			unlinked:"#979797",
			familiar:"#d94350",
			verified:"#148f99",
			transfer:"#4f9d37"
		};
		var state = peep && peep.getKnowledgeState ? peep.getKnowledgeState() : "unlinked";
		return colors[state] || colors.unlinked;
	}
	function _distanceBetween(a, b){
		var dx = a.x-b.x;
		var dy = a.y-b.y;
		return Math.sqrt(dx*dx+dy*dy);
	}
	function _calloutAnchor(slot){
		if(slot.side==="left") return {x:slot.x, y:slot.y+slot.h/2};
		if(slot.side==="right") return {x:slot.x+slot.w, y:slot.y+slot.h/2};
		if(slot.side==="bottom") return {x:slot.x+slot.w/2, y:slot.y+slot.h};
		return {x:slot.x+slot.w/2, y:slot.y};
	}
	function _slotContainsPeep(slot, peep){
		var padding = 42;
		return peep.x>slot.x-padding && peep.x<slot.x+slot.w+padding &&
			peep.y>slot.y-padding && peep.y<slot.y+slot.h+padding;
	}
	function _getVisibleStageBounds(){
		var boardWidth = 960;
		var boardHeight = 540;
		var stage = document.getElementById("simulations");
		var viewport = document.getElementById("simulations_container");
		if(!stage || !viewport) return {left:0, top:0, right:boardWidth, bottom:boardHeight};
		var stageRect = stage.getBoundingClientRect();
		var viewportRect = viewport.getBoundingClientRect();
		var scaleX = stageRect.width/boardWidth || 1;
		var scaleY = stageRect.height/boardHeight || 1;
		var left = (viewportRect.left-stageRect.left)/scaleX;
		var top = (viewportRect.top-stageRect.top)/scaleY;
		var right = (viewportRect.right-stageRect.left)/scaleX;
		var bottom = (viewportRect.bottom-stageRect.top)/scaleY;
		left = Math.max(0, Math.min(boardWidth, left));
		top = Math.max(0, Math.min(boardHeight, top));
		right = Math.max(left, Math.min(boardWidth, right));
		bottom = Math.max(top, Math.min(boardHeight, bottom));
		return {left:left, top:top, right:right, bottom:bottom};
	}
	function _getKnowledgeCalloutSlots(count){
		// Keep every card inside the part of the 960 × 540 artboard that is
		// actually visible. The original demo assumes a desktop-wide viewport;
		// on a narrower window the stage is wider than the viewport, so using the
		// full board here would silently clip the right-hand cards.
		var stageOffsetX = config.x || 0;
		var stageOffsetY = config.y || 0;
		var boardWidth = 960;
		var boardHeight = 540;
		var visible = _getVisibleStageBounds();
		var visibleWidth = Math.max(80, visible.right-visible.left);
		var visibleHeight = Math.max(120, visible.bottom-visible.top);
		var margin = Math.min(12, Math.max(6, Math.floor(Math.min(visibleWidth, visibleHeight)*0.025)));
		var safeSlot = function(id, x, y, w, h, side, tilt, dense, titleLineCount, detailLineCount){
			var safeX = Math.max(visible.left+margin, Math.min(visible.right-margin-w, x));
			var safeY = Math.max(visible.top+margin, Math.min(visible.bottom-margin-h, y));
			return {id:id, x:safeX-stageOffsetX, y:safeY-stageOffsetY, w:w, h:h, side:side, tilt:tilt || 0, dense:!!dense, titleLineCount:titleLineCount, detailLineCount:detailLineCount};
		};
		var standardGap = 8;
		var standardWidth = Math.min(184, Math.max(54, Math.floor((visibleWidth-margin*2-standardGap*2)/3)));
		var standardHeight = Math.min(70, Math.max(54, Math.floor((visibleHeight-margin*2-standardGap*3)/5)));
		var standardLeft = visible.left+margin;
		var standardRight = visible.right-margin-standardWidth;
		var standardCenter = visible.left+(visibleWidth-standardWidth)/2;
		var standardTop = visible.top+margin;
		var standardBottom = visible.bottom-margin-standardHeight;
		var standardSideTop = Math.min(standardBottom-standardHeight-standardGap, standardTop+standardHeight+standardGap);
		var standardSideBottom = Math.max(standardSideTop, standardBottom-standardHeight-standardGap);
		var standard = [
			safeSlot("top-left", standardLeft, standardTop, standardWidth, standardHeight, "bottom", -0.010, false, 1, 2),
			safeSlot("top-right", standardRight, standardTop, standardWidth, standardHeight, "bottom", 0.008, false, 1, 2),
			safeSlot("left-upper", standardLeft, standardSideTop, standardWidth, standardHeight, "right", 0.009, false, 1, 2),
			safeSlot("right-upper", standardRight, standardSideTop, standardWidth, standardHeight, "left", -0.008, false, 1, 2),
			safeSlot("left-lower", standardLeft, standardSideBottom, standardWidth, standardHeight, "right", -0.007, false, 1, 2),
			safeSlot("right-lower", standardRight, standardSideBottom, standardWidth, standardHeight, "left", 0.009, false, 1, 2),
			safeSlot("bottom-left", standardLeft, standardBottom, standardWidth, standardHeight, "top", 0.008, false, 1, 2),
			safeSlot("bottom-center", standardCenter, standardBottom, standardWidth, standardHeight, "top", -0.006, false, 1, 2),
			safeSlot("bottom-right", standardRight, standardBottom, standardWidth, standardHeight, "top", 0.007, false, 1, 2)
		];
		if(count<=standard.length) return standard.slice(0, count);

		var columns = count>26 ? 10 : count>18 ? 8 : 6;
		var cardWidth = count>26 ? 88 : count>18 ? 108 : 142;
		var cardHeight = count>18 ? 82 : 78;
		var gap = 8;
		var usableWidth = visibleWidth - margin*2;
		cardWidth = Math.min(cardWidth, Math.floor((usableWidth-gap*(columns-1))/columns));
		var dense = [];
		cardHeight = Math.min(cardHeight, Math.max(54, Math.floor((visibleHeight-margin*2-gap*3)/4)));
		var topY = visible.top+margin;
		var bottomY = visible.bottom-cardHeight-margin;
		var horizontalSpan = visibleWidth-margin*2-cardWidth;
		var horizontalStep = columns>1 ? horizontalSpan/Math.max(1, columns-1) : 0;
		for(var topIndex=0; topIndex<columns; topIndex++){
			var topX = margin+topIndex*horizontalStep;
			topX += visible.left;
			dense.push(safeSlot("dense-top-"+topIndex, topX, topY, cardWidth, cardHeight, "bottom", topIndex%2 ? 0.004 : -0.004, true, 2, 2));
		}
		for(var bottomIndex=0; bottomIndex<columns; bottomIndex++){
			var bottomX = margin+bottomIndex*horizontalStep;
			bottomX += visible.left;
			dense.push(safeSlot("dense-bottom-"+bottomIndex, bottomX, bottomY, cardWidth, cardHeight, "top", bottomIndex%2 ? -0.004 : 0.004, true, 2, 2));
		}
		var sideRows = Math.ceil(Math.max(0, count-dense.length)/2);
		var sideStart = topY+cardHeight+12;
		var sideEnd = bottomY-cardHeight-12;
		var sideStep = sideRows>1 ? (sideEnd-sideStart)/Math.max(1, sideRows-1) : 0;
		for(var sideIndex=0; sideIndex<sideRows; sideIndex++){
			var sideY = sideRows===1 ? (boardHeight-cardHeight)/2 : sideStart+sideIndex*sideStep;
			if(sideRows===1) sideY = visible.top+(visibleHeight-cardHeight)/2;
			dense.push(safeSlot("dense-left-"+sideIndex, visible.left+margin, sideY, cardWidth, cardHeight, "right", sideIndex%2 ? -0.004 : 0.004, true, 2, 2));
			dense.push(safeSlot("dense-right-"+sideIndex, visible.right-margin-cardWidth, sideY, cardWidth, cardHeight, "left", sideIndex%2 ? 0.004 : -0.004, true, 2, 2));
		}
		return dense.slice(0, count);
	}
	function _getKnowledgePeeps(){
		return self.peeps.map(function(peep, index){
			return {peep:peep, index:index, knowledge:peep.knowledge};
		}).filter(function(item){
			return !!item.knowledge;
		}).sort(function(a, b){
			return (Number(a.knowledge.sceneIndex)||a.index+1) - (Number(b.knowledge.sceneIndex)||b.index+1);
		});
	}
	self.buildKnowledgeCallouts = function(){
		self.knowledgeCallouts = [];
		self.knowledgeCalloutTick = 0;
		if(!self.semanticSceneID) return;
		var featured = _getKnowledgePeeps();
		var slots = _getKnowledgeCalloutSlots(featured.length);
		featured.forEach(function(item, index){
			var bestSlot = null;
			var bestScore = -Infinity;
			slots.forEach(function(slot){
				if(slot.used) return;
				var anchor = _calloutAnchor(slot);
				var score = _distanceBetween(item.peep, anchor);
				var collisions = self.peeps.filter(function(peep){ return _slotContainsPeep(slot, peep); }).length;
				score -= collisions*650;
				if(score>bestScore){
					bestSlot = slot;
					bestScore = score;
				}
			});
			if(!bestSlot) return;
			bestSlot.used = true;
			var relationship = self.connections.find(function(connection){
				return connection.from===item.peep || connection.to===item.peep;
			});
			var relationshipHint = relationship && relationship.relationship ? relationship.relationship.label : "";
			var detailLineCount = bestSlot.detailLineCount===undefined ? 2 : bestSlot.detailLineCount;
			var titleLineCount = bestSlot.titleLineCount || 1;
			var detail = _compactKnowledgeText(item.knowledge.detail, bestSlot.dense ? 48 : 38) || "沿着这条线，看看它如何参与这一幕。";
			var titleLines = _knowledgeLines(item.knowledge.label || "知识原子", bestSlot.dense ? 11 : 15, titleLineCount);
			self.knowledgeCallouts.push({
				peep:item.peep,
				slot:bestSlot,
				anchor:_calloutAnchor(bestSlot),
				titleLines:titleLines.length ? titleLines : ["知识原子"],
				role:_compactKnowledgeText(item.knowledge.role || relationshipHint || "关键线索", bestSlot.dense ? 12 : 11),
				detailLines:_knowledgeLines(detail, bestSlot.dense ? 15 : 16, detailLineCount),
				color:_knowledgeStateColor(item.peep),
				revealAt:index*3
			});
		});
		var stageContainer = document.getElementById("container");
		if(stageContainer){
			stageContainer.setAttribute("data-rhyme-peep-count", String(featured.length));
			stageContainer.setAttribute("data-rhyme-callout-count", String(self.knowledgeCallouts.length));
		}
	};
	self.restartKnowledgeCallouts = function(){
		if(!self.semanticSceneID) return;
		self.knowledgeCalloutTick = 0;
	};
	function _calloutProgress(callout){
		var progress = (self.knowledgeCalloutTick-callout.revealAt)/22;
		return Math.max(0, Math.min(1, progress));
	}
	function _knowledgeOverlayIsOpen(){
		var modal = document.getElementById("modal_container");
		return !!(modal && modal.hasAttribute("show"));
	}
	function _easeOutCubic(value){
		return 1-Math.pow(1-value, 3);
	}
	function _drawPartialLeader(ctx, points, progress){
		var lengths = [];
		var total = 0;
		for(var i=1; i<points.length; i++){
			var length = _distanceBetween(points[i-1], points[i]);
			lengths.push(length);
			total += length;
		}
		var remaining = total*progress;
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for(var segment=0; segment<lengths.length; segment++){
			var from = points[segment];
			var to = points[segment+1];
			if(remaining<=0) break;
			var proportion = Math.min(1, remaining/lengths[segment]);
			ctx.lineTo(from.x+(to.x-from.x)*proportion, from.y+(to.y-from.y)*proportion);
			remaining -= lengths[segment];
			if(proportion<1) break;
		}
	}
	function _knowledgeLeaderPoints(callout, start){
		var anchor = callout.anchor;
		var side = callout.slot.side;
		var visible = _getVisibleStageBounds();
		if(side==="left" || side==="right"){
			var gutterX = anchor.x + (side==="left" ? -28 : 28);
			gutterX = Math.max(visible.left-(config.x || 0)+4, Math.min(visible.right-(config.x || 0)-4, gutterX));
			return [start, {x:gutterX, y:start.y}, {x:gutterX, y:anchor.y}, anchor];
		}
		var gutterY = anchor.y + (side==="top" ? -25 : 25);
		gutterY = Math.max(visible.top-(config.y || 0)+4, Math.min(visible.bottom-(config.y || 0)-4, gutterY));
		return [start, {x:start.x, y:gutterY}, {x:anchor.x, y:gutterY}, anchor];
	}
	function _drawKnowledgeCalloutLeaders(ctx){
		if(!self.semanticSceneID || !self.knowledgeCallouts.length || _knowledgeOverlayIsOpen()) return;
		self.knowledgeCallouts.forEach(function(callout){
			var reveal = _calloutProgress(callout);
			if(reveal<=0) return;
			var lineProgress = _easeOutCubic(Math.min(1, reveal*1.35));
			var vector = {x:callout.anchor.x-callout.peep.x, y:callout.anchor.y-callout.peep.y};
			var length = Math.sqrt(vector.x*vector.x+vector.y*vector.y) || 1;
			var start = {
				x:callout.peep.x+vector.x/length*31,
				y:callout.peep.y+vector.y/length*31
			};
			var points = _knowledgeLeaderPoints(callout, start);
			ctx.save();
			ctx.globalAlpha = 0.58;
			ctx.strokeStyle = callout.color;
			ctx.lineWidth = 1.45;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			_drawPartialLeader(ctx, points, lineProgress);
			ctx.stroke();
			ctx.globalAlpha = 0.18;
			ctx.translate(0.7, -0.55);
			_drawPartialLeader(ctx, points, Math.max(0, lineProgress-0.025));
			ctx.stroke();
			ctx.restore();
		});
	}
	function _drawKnowledgeCalloutCards(ctx){
		if(!self.semanticSceneID || !self.knowledgeCallouts.length || _knowledgeOverlayIsOpen()) return;
		self.knowledgeCallouts.forEach(function(callout, index){
			var reveal = _calloutProgress(callout);
			if(reveal<0.22) return;
			var cardProgress = _easeOutCubic(Math.min(1, (reveal-0.22)/0.78));
			var scale = 0.92 + cardProgress*0.08;
			var offset = (1-cardProgress)*10;
			var slot = callout.slot;
			var dense = !!slot.dense;
			var height = slot.h;
			var x = slot.x;
			var y = slot.y;
			if(slot.side==="left") x += offset;
			if(slot.side==="right") x -= offset;
			if(slot.side==="top") y += offset;
			if(slot.side==="bottom") y -= offset;

			ctx.save();
			ctx.globalAlpha = cardProgress;
			ctx.translate(x+slot.w/2, y+height/2);
			ctx.rotate(slot.tilt || 0);
			ctx.scale(scale, scale);
			ctx.translate(-slot.w/2, -height/2);
			ctx.shadowColor = "rgba(34,34,34,0.12)";
			ctx.shadowBlur = 10;
			ctx.shadowOffsetY = 3;
			_roundKnowledgeRect(ctx, 0, 0, slot.w, height, 10);
			ctx.fillStyle = "rgba(255,255,255,0.97)";
			ctx.fill();
			ctx.shadowColor = "transparent";
			ctx.lineWidth = 1.55;
			ctx.strokeStyle = "rgba(44,44,44,0.62)";
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(dense ? 10 : 13, dense ? 9 : 12);
			ctx.lineTo(dense ? 10 : 13, height-(dense ? 9 : 12));
			ctx.strokeStyle = callout.color;
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(dense ? 18 : 23, dense ? 14 : 16, dense ? 2.7 : 3.2, 0, Math.TAU);
			ctx.fillStyle = callout.color;
			ctx.fill();
			// Text is clipped to the card's inner paper so a long generated atom
			// can never paint over the neighbouring card or outside the board.
			ctx.save();
			_roundKnowledgeRect(ctx, 7, 7, slot.w-14, height-14, 7);
			ctx.clip();
			ctx.font = (dense ? "14px" : "13px") + " PatrickHand";
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "#222";
			var titleX = dense ? 25 : 31;
			var titleStartY = dense ? 14 : 17;
			var titleStep = dense ? 15 : 14;
			var maxTitleLines = Math.max(1, Math.floor((height-(dense ? 26 : 25))/titleStep));
			var titleLines = (callout.titleLines || ["知识原子"]).slice(0, maxTitleLines);
			titleLines.forEach(function(line, titleIndex){
				ctx.fillText(line, titleX, titleStartY+titleIndex*titleStep);
			});
			var roleY = dense ? titleStartY+titleLines.length*titleStep+1 : 32;
			roleY = Math.min(height-25, roleY);
			ctx.font = (dense ? "10.5px" : "9px") + " PatrickHand";
			ctx.fillStyle = callout.color;
			ctx.fillText(callout.role, dense ? 18 : 23, roleY);
			ctx.font = (dense ? "11.5px" : "10px") + " PatrickHand";
			ctx.fillStyle = "#595959";
			var detailStep = dense ? 12.5 : 12;
			var detailStart = roleY+(dense ? 13 : 13);
			var maxDetailLines = Math.max(1, Math.floor((height-detailStart-5)/detailStep));
			callout.detailLines.slice(0, maxDetailLines).forEach(function(line, lineIndex){
				ctx.fillText(line, dense ? 18 : 23, detailStart+lineIndex*detailStep);
			});
			ctx.restore();
			ctx.restore();
		});
	}
	self.focusKnowledgeAtom = function(peep){
		if(!peep || !peep.knowledge) return false;
		self.focusedPeep = (self.focusedPeep===peep) ? null : peep;
		self.focusedConnection = self.focusedPeep
			? self.connections.find(function(connection){
				return connection.from===self.focusedPeep || connection.to===self.focusedPeep;
			}) || null
			: null;
		self.knowledgeFocusTick = 0;
		if(self.focusedPeep && window.RHYME_KNOWLEDGE_ATOMS && window.RHYME_KNOWLEDGE_ATOMS.recordAtomFocus){
			window.RHYME_KNOWLEDGE_ATOMS.recordAtomFocus(self.focusedPeep.knowledge);
		}
		if(window.RHYME_STAGE){
			if(self.focusedPeep){
				var state = self.focusedPeep.getKnowledgeState && self.focusedPeep.getKnowledgeState();
				var stateLabels = {
					unlinked:"尚未建立关系",
					familiar:"只记住答案",
					verified:"经过多重验证",
					transfer:"能够迁移"
				};
				window.RHYME_STAGE.focusAtom(self.focusedPeep.knowledge, stateLabels[state]);
			}else if(window.RHYME_STAGE.clearFocus){
				window.RHYME_STAGE.clearFocus();
			}
		}
		return true;
	};

	// CONTAGION SOUND
	//var _CONTAGION_SOUND = 0;
	var _PLAY_CONTAGION_SOUND = function(){
		//_CONTAGION_SOUND = (_CONTAGION_SOUND+1)%3;
		//SOUNDS["contagion"+_CONTAGION_SOUND].play();
		SOUNDS.contagion.volume(0.75);
		SOUNDS.contagion.play();
	};

	// Canvas
	if(config.fullscreen){
		var container = $("#simulations_container");
		self.canvas = createCanvas(container.clientWidth, container.clientHeight);
	}else{
		alert("this code should not run. if it does, something bad has happened.");
		/*(self.canvas = createCanvas(config.width||500, config.height||500);
		self.canvas.style.left = config.x || 0;
		self.canvas.style.top = config.y || 0;*/
	}
	//self.canvas.style.border = "1px solid #ccc";
	self.ctx = self.canvas.getContext('2d');

	// Mouse, offset!
	self.mouse = {x:0, y:0};

	// Connector-Cutter
	self.connectorCutter = new ConnectorCutter({sim:self});

	// Resize
	var simOffset;
	self.resize = function(){

		var container = $("#simulations_container");
		simOffset = _getBoundingClientRect(self.container.dom);
		self.canvas.style.left = (-simOffset.x) + "px";
		self.canvas.style.top = (-simOffset.y) + "px";

		// Set difference in width & height
		var width = container.clientWidth;
		var height = container.clientHeight;
		self.canvas.width = width*2;
		self.canvas.height = height*2;
		self.canvas.style.width = (width) + "px";
		self.canvas.style.height = (height) + "px";

	};
	self.resize();

	// Networks... clear/init
	self.clear = function(){
		self.peeps = [];
		self.connections = [];
		self.contagion = 0;
		self.focusedPeep = null;
		self.focusedConnection = null;
		self.knowledgeCallouts = [];
		self.knowledgeCalloutTick = 0;
		if(window.RHYME_STAGE && window.RHYME_STAGE.clearFocus) window.RHYME_STAGE.clearFocus();
	};
	function _semanticNetworkLayout(points){
		if(!self.semanticSceneID || !points || !points.length) return null;
		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		points.forEach(function(point){
			minX = Math.min(minX, point[0]);
			maxX = Math.max(maxX, point[0]);
			minY = Math.min(minY, point[1]);
			maxY = Math.max(maxY, point[1]);
		});
		var sourceWidth = Math.max(1, maxX-minX);
		var sourceHeight = Math.max(1, maxY-minY);
		var visible = _getVisibleStageBounds();
		var visibleWidth = Math.max(220, visible.right-visible.left);
		var visibleHeight = Math.max(180, visible.bottom-visible.top);
		var targetWidth = Math.min(points.length>14 ? 524 : 504, visibleWidth-24);
		var targetHeight = Math.min(points.length>14 ? 210 : 246, visibleHeight-24);
		var target = {
			x: visible.left+(visibleWidth-targetWidth)/2,
			y: visible.top+(visibleHeight-targetHeight)/2,
			w: Math.max(180, targetWidth),
			h: Math.max(150, targetHeight)
		};
		var scale = Math.min(target.w/sourceWidth, target.h/sourceHeight, 1);
		var sourceCenterX = (minX+maxX)/2;
		var sourceCenterY = (minY+maxY)/2;
		return function(point){
			return {
				x:target.x+target.w/2+(point[0]-sourceCenterX)*scale-(config.x || 0),
				y:target.y+target.h/2+(point[1]-sourceCenterY)*scale-(config.y || 0)
			};
		};
	}
	function _fallbackKnowledge(index){
		var atoms = [
			["起始条件", "前提", "先确认这一幕成立所需要的条件。"],
			["关键变量", "对象", "观察哪个对象正在改变，以及改变了什么。"],
			["连接规则", "关系", "沿着连线判断两个知识原子如何影响彼此。"],
			["判断门槛", "机制", "找到触发下一步变化所需要达到的门槛。"],
			["证据合流", "证据", "把不同来源的信息合并后再作出判断。"],
			["反例提醒", "反例", "检查是否存在能够推翻当前结论的情况。"],
			["适用边界", "边界", "明确这个结论在哪些范围内才有效。"],
			["迁移应用", "应用", "把当前关系迁移到一个新的问题中。"],
			["自我检验", "自检", "用一个反问确认自己是否真的理解。"],
			["反馈结果", "反馈", "观察结果如何反过来影响下一轮判断。"],
			["修正路径", "修正", "当证据不一致时调整原来的推理路线。"],
			["总结输出", "结论", "把这一幕最终得到的判断表达出来。"]
		];
		var atom = atoms[index] || ["补充线索 "+(index+1), "线索", "观察它与相邻节点形成的独特关系。"];
		return {label:atom[0], role:atom[1], detail:atom[2], sceneIndex:index+1};
	}
	self.init = function(){

		// Clear!
		self.clear();

		// Peeps
		var semanticScene = self.getKnowledgeScene();
		var semanticLayout = _semanticNetworkLayout(self.networkConfig.peeps);
		self.networkConfig.peeps.forEach(function(p, index){
			var semanticPosition = semanticLayout ? semanticLayout(p) : null;
			var x = semanticPosition ? semanticPosition.x : p[0],
				y = semanticPosition ? semanticPosition.y : p[1],
				infected = p[2];
			var knowledge = semanticScene && semanticScene.nodes ? semanticScene.nodes[index] : null;
			if(self.semanticSceneID && !knowledge) knowledge = _fallbackKnowledge(index);
			if(knowledge){
				knowledge.sceneIndex = knowledge.sceneIndex || index+1;
				knowledge.sceneCount = knowledge.sceneCount || self.networkConfig.peeps.length;
			}
			self.addPeep(x, y, infected, knowledge);
		});

		// Connections
		self.networkConfig.connections.forEach(function(c){
			var from = self.peeps[c[0]],
				to = self.peeps[c[1]],
				uncuttable = c[2]||false,
				relationship = self.getKnowledgeRelationship(c[0], c[1]);
			self.addConnection(from, to, uncuttable, relationship);
		});

		// Contagion
		self.contagion = self.networkConfig.contagion;
		self.buildKnowledgeCallouts();

	};

	// Update
	self.onupdate = config.onupdate || function(){};
	self.update = function(){

		// "Mouse", offset!
		var canvasBounds = _getBoundingClientRect(self.canvas);
		self.mouse = cloneObject(Mouse);
		self.mouse.x -= canvasBounds.x;
		self.mouse.y -= canvasBounds.y;
		self.mouse.lastX -= canvasBounds.x;
		self.mouse.lastY -= canvasBounds.y;
		if(config.fullscreen){
			var fullscreenOffsetX = config.x + simOffset.x;
			var fullscreenOffsetY = config.y + simOffset.y;
			self.mouse.x -= fullscreenOffsetX;
			self.mouse.y -= fullscreenOffsetY;
			self.mouse.lastX -= fullscreenOffsetX;
			self.mouse.lastY -= fullscreenOffsetY;
		}

		// Connector-Cutter
		self.connectorCutter.update();

		// Connections & Peeps
		self.connections.forEach(function(connection){
			connection.update();
		});
		self.peeps.forEach(function(peep){
			peep.update();
		});
		if(self.focusedPeep){
			self.knowledgeFocusTick += 1;
		}
		if(self.semanticSceneID && self.knowledgeCalloutTick<1000){
			self.knowledgeCalloutTick += 1;
		}

		// secret editor...
		// drag Peep
		if(_draggingPeep){
			_draggingPeep.x = self.mouse.x+_draggingOffset.x;
			_draggingPeep.y = self.mouse.y+_draggingOffset.y;
			_draggingPeep.velocity.x = 0;
			_draggingPeep.velocity.y = 0;
		}

		// update confetti & winword...
		self.confetti.forEach(function(confetti){

			confetti.x += confetti.vx;
			confetti.y += confetti.vy;
			confetti.spin += confetti.spinSpeed;

			confetti.vy += confetti.g;

			confetti.vx *= 0.95;
			confetti.vy *= 0.95;

		});
		if(self.winWord.ticker>=0){
			self.winWord.ticker += 1/60;
			if(self.winWord.ticker>3){
				self.winWord.ticker = -1;
			}
		}

		// On update! (for arbitrary sim-specific logic)
		self.onupdate(self);

	};

	// Draw
	self.draw = function(){

		// Retina
		var ctx = self.ctx;
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		// todo: smarter redraw coz, wow, retina.
		ctx.save();
		ctx.scale(2,2);
		if(config.fullscreen){
			var fullscreenOffsetX = config.x + simOffset.x;
			var fullscreenOffsetY = config.y + simOffset.y;
			ctx.translate(fullscreenOffsetX, fullscreenOffsetY);
		}

		// Draw all of it!
		self.connectorCutter.draw(ctx);
		self.connections.forEach(function(connection){
			connection.draw(ctx);
		});
		_drawKnowledgeCalloutLeaders(ctx);
		self.peeps.forEach(function(peep){
			peep.draw(ctx);
		});
		_drawKnowledgeCalloutCards(ctx);

		ctx.restore();

		// Draw confetti - NOT AFFECTED BY TRANSFORMS.
		self.confetti.forEach(function(confetti){
			ctx.save();
				var offsetX = -Math.sin(confetti.spin)*9;
				ctx.translate(confetti.x+offsetX, confetti.y);
				ctx.rotate(Math.sin(confetti.spin)*0.2);
				if(confetti.flip) ctx.scale(-1,1);
				self.confettiSprite.gotoFrame(confetti.frame);
				self.confettiSprite.draw(ctx);
			ctx.restore();
		});

		// Draw WIN WORD
		if(self.winWord.ticker>=0){

			ctx.save();
			ctx.translate(self.winWord.x, self.winWord.y);
			ctx.scale(2,2); // retina

			// expand
			if(self.winWord.ticker<0.2){
				var scale = self.winWord.ticker/0.2;
				ctx.scale(scale,scale);
			}

			// fade away
			if(self.winWord.ticker>2){
				var alpha = -(self.winWord.ticker-3);
				ctx.globalAlpha = alpha;
			}

			ctx.font = '100px PatrickHand';
			ctx.fillStyle = "#000";
			ctx.textBaseline = "middle";
			ctx.fontWeight = "bold";
			ctx.textAlign = "center";
			var label = getWords("WIN");
			ctx.fillText(label, 0, 0);

			ctx.restore();

		}

	};

	// Kill
	self.kill = function(){
		
		self.clear();

		// key handlers, too
		_keyHandlers.forEach(function(_handler){
			unsubscribe(_handler);
		});

	};

	///////////////////
	// WINNER WINNER //
	///////////////////

	self.wonBefore = false;
	self.confetti = [];
	self.winWord = {x:0, y:0, ticker:-1};

	// Confetti Sprite
	self.confettiSprite = new Sprite({
		img: "confetti",
		frames:3, sw:100, sh:50,
	});
	self.confettiSprite.pivotX = 50;
	self.confettiSprite.pivotY = 50;
	self.confettiSprite.scale = 0.5;

	self.win = function(bounds){

		// ONLY ONCE
		if(self.wonBefore) return;
		self.wonBefore = true;

		// SOUND!
		if(bounds && bounds.small){
			SOUNDS.party_short.play();
		}else{
			SOUNDS.party.play();
		}

		// AMOUNT OF CONFETTI
		var AMOUNT_OF_CONFETTI = 100;
		if(bounds && bounds.small){
			AMOUNT_OF_CONFETTI = 50;
		}

		// Get center of peeps
		var fullscreenOffsetX = config.x + simOffset.x;
		var fullscreenOffsetY = config.y + simOffset.y;
		if(!bounds || !bounds.x) bounds = getBoundsOfPoints(self.peeps); // OPTIONAL BOUNDS
		var cx = bounds.x + bounds.width/2;
		var cy = bounds.y + bounds.height/2;
		cx += fullscreenOffsetX;
		cy += fullscreenOffsetY;
		cx *= 2; // retina
		cy *= 2; // retina

		// Place Win Word
		self.winWord.x = cx;
		self.winWord.y = cy;
		self.winWord.ticker = 0;

		// Place confetti
		for(var i=0; i<AMOUNT_OF_CONFETTI; i++){
			var angle = Math.random()*Math.TAU;
			var burst = bounds.width/15;
			var frame = Math.floor(Math.random()*5);
			var spinSpeed = 0.03+Math.random()*0.03;
			var confetti = {
				x: cx,
				y: cy,
				vx: Math.cos(angle)*Math.random()*burst,
				vy: Math.sin(angle)*Math.random()*burst - burst*0.25,
				frame: frame,
				spinSpeed: spinSpeed,
				spin: Math.random()*Math.TAU,
				g: 0.10+Math.random()*0.10,
				flip: (Math.random()<0.5)
			};
			self.confetti.push(confetti);
		}

	};

	////////////////////////
	// SIMULATION RUNNING //
	////////////////////////

	self.STEP = 0;

	self.save = function(){
		self.STEP = 0;
		self.networkConfig = self.getCurrentNetwork();
	};

	self._canPlayBonkSound = true;

	self.reload = function(){
		var contagionLevel = self.contagion; // hack for sandbox: keep contagion the same
		self.STEP = 0;
		self._canPlayBonkSound = true;
		self.init();
		self.contagion = contagionLevel;
	};

	self.nextStep = function(){

		// SOUND! If anyone can be infected, play Contagion sound.
		// Otherwise play Bonk sound ONCE
		var canBeInfected = self.peeps.filter(function(peep){
			return !peep.infected && peep.isPastThreshold;
		}).length;
		var isEveryoneInfected = true;
		self.peeps.forEach(function(peep){
			if(!peep.infected) isEveryoneInfected=false;
		});
		if(canBeInfected>0){
			_PLAY_CONTAGION_SOUND();
		}else if(self._canPlayBonkSound && !isEveryoneInfected){
			self._canPlayBonkSound = false;

			if(!self.options.NO_BONK){
				SOUNDS.bonk.play();
			}
			
		}

		// "Infect" the peeps who need to get infected
		setTimeout(function(){
			self.STEP++;
		},400);

		// CONNECTIONS: IF one is INFECTED and the other is PAST THRESHOLD, then ANIMATE
		self.connections.forEach(function(c){
			c.animate();
		});

		// PEEPS: If not already infected & past threshold, infect
		self.peeps.forEach(function(peep){
			if(!peep.infected && peep.isPastThreshold){
				// timeout for animation
				setTimeout(function(){
					peep.infect();
				},333);
			}
		});

		// PEEPS: If NOT infected, NOT past threshold, and a friend IS INFECTED, then SHAKE
		self.peeps.forEach(function(peep){
			if(!peep.infected && !peep.isPastThreshold){
				var friends = self.getFriendsOf(peep);
				var infectedFriends = friends.filter(function(f){
					return f.infected;
				});
				if(infectedFriends.length>0){
					peep.shake();
				}
			}
		});

	};

	///////////////////////////////
	// secret keyboard interface //
	///////////////////////////////

	// todo: active only when mouse is over MY CANVAS.

	var _draggingPeep = null;
	var _draggingOffset = {x:0,y:0};
	var _keyHandlers = [];
	var _resetConnectorCutter = function(){
		self.connectorCutter.sandbox_state = 0;
	};
	_keyHandlers.push(subscribe("key/down/space",function(){
		_resetConnectorCutter();
		self._startMove();	
	}));
	self._startMove = function(){
		if(!_draggingPeep){ // prevent double-activation
			var hoveredPeep = self.getHoveredPeep(0);
			if(hoveredPeep){
				_draggingPeep = hoveredPeep;
				_draggingOffset.x = _draggingPeep.x-self.mouse.x;
				_draggingOffset.y = _draggingPeep.y-self.mouse.y;

				// Sound!
				SOUNDS.squeak_down.volume(0.6);
				SOUNDS.squeak_down.play();

			}
		}
	};
	_keyHandlers.push(subscribe("key/up/space",function(){
		self._stopMove();	
	}));
	self._stopMove = function(){
		
		// Sound!
		SOUNDS.squeak_up.volume(0.6);
		SOUNDS.squeak_up.play();

		_draggingPeep = null;

	};
	_keyHandlers.push(subscribe("key/down/1",function(){
		_resetConnectorCutter();
		self._addPeepAtMouse(false);
	}));
	_keyHandlers.push(subscribe("key/down/2",function(){
		_resetConnectorCutter();
		self._addPeepAtMouse(true);
	}));
	self._addPeepAtMouse = function(infected){

		// SOUND
		SOUNDS.pop.play();

		self.addPeep(self.mouse.x, self.mouse.y, infected);

	};
	_keyHandlers.push(subscribe("key/down/delete",function(){
		_resetConnectorCutter();
		self._deletePeep();	
	}));
	self._deletePeep = function(){

		// SOUND
		SOUNDS.trash.play();

		var toDeletePeep = self.getHoveredPeep(0);
		if(toDeletePeep) self.removePeep(toDeletePeep);

	};

	self.getCurrentNetwork = function(){
		var savedNetwork = {
			contagion: self.contagion,
			peeps: [],
			connections: []
		};
		self.peeps.forEach(function(peep){
			savedNetwork.peeps.push([Math.round(peep.x), Math.round(peep.y), peep.infected?1:0]);
		});
		self.connections.forEach(function(c){
			var fromIndex = self.peeps.indexOf(c.from);
			var toIndex = self.peeps.indexOf(c.to);
			var uncuttable = c.uncuttable ? 1 : 0;
			savedNetwork.connections.push([fromIndex, toIndex, uncuttable]);
		});
		return savedNetwork;
	};
	self.serialize = function(){
		var savedNetwork = self.getCurrentNetwork();
		return '{\n'+
		'\t"contagion":'+savedNetwork.contagion+",\n"+
		'\t"peeps":'+JSON.stringify(savedNetwork.peeps)+",\n"+
		'\t"connections":'+JSON.stringify(savedNetwork.connections)+"\n"+
		'}';
	};

	////////////////
	// HELPERS... //
	////////////////

	// Add Peeps/Connections
	self.addPeep = function(x, y, infected, knowledge){
		var peep = new Peep({ x:x, y:y, infected:infected, sim:self, knowledge:knowledge });
		self.peeps.push(peep);
		return peep;
	};
	self.removePeep = function(peep){
		self.removeAllConnectedTo(peep); // delete all connections
		removeFromArray(self.peeps, peep); // BYE peep
	};
	self.addConnection = function(from, to, uncuttable, relationship){

		// Don't allow connecting to self...
		if(from==to) return;

		// ...or if already exists, in either direction
		for(var i=0; i<self.connections.length; i++){
			var c = self.connections[i];
			if(c.from==from && c.to==to) return;
			if(c.from==to && c.to==from) return;
		}

		// Otherwise, go ahead and add it!
		var connection = new Connection({ from:from, to:to, uncuttable:uncuttable, sim:self, relationship:relationship });
		self.connections.push(connection);
		return connection;

	};
	self.getFriendsOf = function(peep){
		var friends = [];
		for(var i=0; i<self.connections.length; i++){ // in either direction
			var c = self.connections[i];
			if(c.from==peep) friends.push(c.to);
			if(c.to==peep) friends.push(c.from);
		}
		return friends;
	};
	self.getHoveredPeep = function(mouseBuffer){
		mouseBuffer = mouseBuffer || 0;
		return self.peeps.find(function(peep){
			return peep.hitTest(self.mouse.x, self.mouse.y, mouseBuffer);
		});
	};
	self.tryCuttingConnections = function(line){
		var wasLineCut = 0;
		for(var i=self.connections.length-1; i>=0; i--){ // going BACKWARDS coz killing connections
			var c = self.connections[i];
			if(c.hitTest(line)){
				if(c.uncuttable){ // can't cut uncuttables!
					wasLineCut = -1;
					c.shake();
				}else{
					wasLineCut = 1;
					self.connections.splice(i,1);
				}
			}
		}
		return wasLineCut;
	};
	self.removeAllConnectedTo = function(peep){
		for(var i=self.connections.length-1; i>=0; i--){ // backwards index coz we're deleting
			var c = self.connections[i];
			if(c.from==peep || c.to==peep){ // in either direction
				self.connections.splice(i,1); // remove!
			}
		}
	};


	//////////////
	// INIT NOW //
	//////////////

	// Start Uncuttable?
	if(self.options.startUncuttable){
		self.networkConfig.connections.forEach(function(c){
			c[2] = 1;
		});
	}

	self.init();

	// Start randomize positions?
	if(self.options.randomStart){
		var r = {
			x:self.options.randomStart,
			y:0
		};
		self.peeps.forEach(function(peep){
			var randomPush = rotateVector(r, Math.random()*Math.TAU);
			peep.x += randomPush.x;
			peep.y += randomPush.y;
		});
	}

}
