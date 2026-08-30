function Peep(config){
	
	var self = this;

	// Properties
	self.x = config.x;
	self.y = config.y;
	self.velocity = {x:0, y:0};
	self.infected = !!config.infected;
	self.sim = config.sim;
	self.knowledge = config.knowledge || null;
	self.isKnowledgeHovered = false;
	self.getKnowledgeState = function(){
		if(!self.knowledge) return null;
		return self.infected ? (self.knowledge.activeState || "familiar") : (self.knowledge.state || "unlinked");
	};

	// Update:
	self.numFriends = 0;
	self.numInfectedFriends = 0;
	self.isPastThreshold = false;
	self.faceX = 0;
	self.faceY = 0;
	self.faceBlink = 0;
	self.isMajority = false;
	var _faceFollow = 0.75+(Math.random()*0.1);
	self.update = function(){

		// Face position!
		var faceVector = {
			x: (self.sim.mouse.x-self.x)/5,
			y: (self.sim.mouse.y-self.y)/5
		};
		faceVector.mag = Math.sqrt(faceVector.x*faceVector.x + faceVector.y*faceVector.y);
		var max_distance = 5;
		if(faceVector.mag>max_distance){
			faceVector.x = faceVector.x * (max_distance/faceVector.mag);
			faceVector.y = faceVector.y * (max_distance/faceVector.mag);
		}
		self.faceX = self.faceX*_faceFollow + faceVector.x*(1-_faceFollow);
		self.faceY = self.faceY*_faceFollow + faceVector.y*(1-_faceFollow);

		// Blink?
		if(!self.faceBlink){
			if(Math.random()<0.002) self.faceBlink=true;
		}else{
			if(Math.random()<0.07) self.faceBlink=false;
		}

		// Friends connected... or infected
		var friends = self.sim.getFriendsOf(self);
		self.numFriends = friends.length;
		self.numInfectedFriends = 0;
		friends.forEach(function(friend){
			if(friend.infected) self.numInfectedFriends++;
		});

		// Past threshold?
		self.isPastThreshold = false;
		if(self.sim.contagion==0){
			// simple
			if(self.numInfectedFriends>0) self.isPastThreshold = true;
		}else{
			// complex
			if(self.numFriends>0){
				var ratio = self.numInfectedFriends/self.numFriends;
				if(ratio>=self.sim.contagion-0.0001){ // floating point errors
					self.isPastThreshold = true;
				}
			}
		}

		// SPLASH: FORCE-DIRECTED
		if(self.sim.options.splash){

			// Attract towards 0 (gravity increases slightly the further you get out)
			var gravity = getUnitVector({
				x: 0 - self.x,
				y: 0 - self.y
			});
			var gravityScale = getVectorLength(self)*0.00012;
			if(self.sim.options.CONCLUSION){
				gravityScale *= 2;
			}
			gravity = multiplyVector(gravity, gravityScale);
			self.velocity = addVectors(self.velocity, gravity);

			// If within the ring, push OUT.
			if(!self.sim.options.CONCLUSION){
				var RADIUS = 325;
				var distanceFromCenter = getVectorLength(self);
				if(distanceFromCenter<RADIUS){
					var forcePushOut = RADIUS-distanceFromCenter;
					forcePushOut *= 0.05;
					forcePushOut = Math.min(forcePushOut, 2); //cap
					var forceDirection = getUnitVector(self);
					var forceOut = multiplyVector( forceDirection, forcePushOut );
					self.velocity = addVectors(self.velocity, forceOut);
				}
			}

			// Hookes to Connected
			var k = 0.002;
			var hookesDistance = 140;
			var hookesTotalForce = {x:0, y:0};
			friends.forEach(function(friend){

				var fromTo = getVectorFromTo(self, friend);
				var d = getVectorLength(fromTo) - hookesDistance;
				var forceMagnitude = k*d;
				var force = multiplyVector( getUnitVector(fromTo), forceMagnitude );

				hookesTotalForce = addVectors(hookesTotalForce, force);

			});
			self.velocity = addVectors(self.velocity, hookesTotalForce);

			// Coulomb from Disconnected
			var c = -300;
			if(self.sim.options.CONCLUSION){
				c = -400;
			}
			var coulombTotalForce = {x:0, y:0};
			self.sim.peeps.forEach(function(peep){
				
				if(peep==self) return; // not self
				if(friends.indexOf(peep)>=0) return; // not a friend

				var fromTo = getVectorFromTo(self, peep);
				var d = getVectorLength(fromTo);
				var forceMagnitude = c/(d*d);
				var force = multiplyVector( getUnitVector(fromTo), forceMagnitude );

				coulombTotalForce = addVectors(coulombTotalForce, force);

			});
			self.velocity = addVectors(self.velocity, coulombTotalForce);

			// Travel Clockwise
			var spin = getUnitVector(self);
			spin = rotateVector(spin, Math.TAU/4);
			spin = multiplyVector(spin, 0.02*0.25); // even less spin
			self.velocity = addVectors(self.velocity, spin);

			// Air Friction
			self.velocity = multiplyVector(self.velocity, 0.95);

			// Move
			self.x += self.velocity.x;
			self.y += self.velocity.y;

		}

		if(self.knowledge){
			self.isKnowledgeHovered = self.hitTest(self.sim.mouse.x, self.sim.mouse.y, true);
			_knowledgePulse += 0.045;
		}

	};

	// Body Sprite
	var _initSpriteScale = 0.3;
	self.sprite = new Sprite({
		img: "peeps",
		frames:6, sw:200, sh:200,
	});
	self.sprite.pivotX = 100;
	self.sprite.pivotY = 100;
	self.sprite.scale = _initSpriteScale;

	// Prop Sprite
	self.propSprite = new Sprite({
		img: "peeps",
		frames:6, sw:200, sh:200,
	});
	self.propSprite.pivotX = 100;
	self.propSprite.pivotY = 100;
	self.propSprite.scale = _initSpriteScale;
	var _bottleAnim = Math.random()*Math.TAU;
	var _bottleSpeed = 0.01 + Math.random()*0.01;

	// Draw
	var radius = 25;
	var barWidth = radius*2;
	var barHeight = 10;
	var bodyRotation = Math.TAU*Math.random();
	var PEEP_COLORS = [
		"#B4B4B4", // gray
		"#F73C50", // red
		"#FEE576", // yellow
		"#86F5FB", // blue
		"#7DE74E", // green
		"#FBCBDC" // pink
	];
	var KNOWLEDGE_STATE_FRAMES = {
		unlinked:0,
		familiar:1,
		verified:3,
		transfer:4
	};
	var _glowAnim = 0;
	var _knowledgePulse = 0;
	self.conclusionFrame = Math.floor(1+Math.random()*5);

	function _roundRect(ctx, x, y, width, height, radius){
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
	function _compactKnowledgeText(value, limit){
		var raw = String(value || "");
		var text = window.RHYME_MATH && window.RHYME_MATH.readable
			? window.RHYME_MATH.readable(raw)
			: raw.replace(/\\([A-Za-z]+)/g, "$1");
		text = text.replace(/\s+/g, " ").trim();
		if(limit && text.length>limit) return text.slice(0, Math.max(1, limit-1)).replace(/[，、；;：: ]+$/, "")+"…";
		return text;
	}
	function _wrapKnowledgeText(ctx, text, maxWidth, maxLines){
		var lines = [];
		var current = "";
		text = _compactKnowledgeText(text, 120);
		for(var i=0; i<text.length; i++){
			var next = current+text.charAt(i);
			if(current && ctx.measureText(next).width>maxWidth){
				lines.push(current);
				current = text.charAt(i);
				if(lines.length===maxLines) break;
			}else{
				current = next;
			}
		}
		if(current && lines.length<maxLines) lines.push(current);
		if(lines.length===maxLines && textSignatureForPeep(lines.join(""))!==textSignatureForPeep(text)){
			lines[maxLines-1] = lines[maxLines-1].slice(0, Math.max(1, lines[maxLines-1].length-1)).replace(/[，、；;：: ]+$/, "")+"…";
		}
		return lines;
	}
	function textSignatureForPeep(value){
		return String(value || "").replace(/\s+/g, "");
	}
	function _knowledgeRoleToken(role){
		var value = String(role || "");
		if(/定义|概念|对象/.test(value)) return "定";
		if(/条件|前提|限制/.test(value)) return "条";
		if(/机制|过程|步骤|计算/.test(value)) return "理";
		if(/证据|数据|观察|检验/.test(value)) return "证";
		if(/反例|错误|修正/.test(value)) return "反";
		if(/边界|范围|特殊/.test(value)) return "界";
		if(/迁移|应用|新题/.test(value)) return "迁";
		if(/结论|判断|输出/.test(value)) return "结";
		return "知";
	}
	function _drawKnowledgeBadge(ctx, color){
		if(!self.knowledge) return;
		var index = Math.max(1, Number(self.knowledge.sceneIndex) || 1);
		var tick = Math.max(0, Number(self.sim.knowledgeCalloutTick) || 0);
		var progress = Math.max(0, Math.min(1, (tick-(index-1)*2)/12));
		var eased = 1-Math.pow(1-progress, 3);
		var isActive = self.isKnowledgeHovered || self.sim.focusedPeep===self;
		var width = isActive ? 39 : 34;
		var height = 16;
		var label = String(index).padStart(2, "0")+"·"+_knowledgeRoleToken(self.knowledge.role);

		ctx.save();
		ctx.translate(19, -23);
		ctx.scale((0.72+eased*0.28)*(isActive ? 1.08 : 1), (0.72+eased*0.28)*(isActive ? 1.08 : 1));
		ctx.globalAlpha = 0.3+eased*0.68;
		_roundRect(ctx, -width/2, -height/2, width, height, 8);
		ctx.fillStyle = "rgba(255,255,255,0.96)";
		ctx.fill();
		ctx.strokeStyle = color;
		ctx.lineWidth = isActive ? 1.8 : 1.25;
		ctx.stroke();
		ctx.font = "9px PatrickHand";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#333";
		ctx.fillText(label, 0, 0.5);
		ctx.restore();
	}
	function _drawKnowledgeTag(ctx, color){
		if(!self.knowledge) return;

		var knowledge = self.knowledge;
		var isFocused = (self.sim.focusedPeep===self);
		var isHovered = self.isKnowledgeHovered && !Simulations.IS_RUNNING;
		// Never label every atom at once. A graph stays readable when the learner
		// sees a label only for the atom they are inspecting (or hovering).
		if(!isFocused && !isHovered) return;
		var offset = knowledge.labelOffset || [0,-48];
		var title = _compactKnowledgeText(knowledge.label || "知识原子", 18);
		var role = _compactKnowledgeText(knowledge.role || "知识点", 13);
		var detail = knowledge.detail || "点击这张脸，查看它和相邻知识的关系。";
		var scale = isFocused ? 1.07 : (isHovered ? 1.035 : 1);

		ctx.save();
		ctx.translate(offset[0], offset[1]);
		ctx.scale(scale, scale);
		ctx.font = "15px PatrickHand";
		var titleWidth = ctx.measureText(title).width;
		ctx.font = "10px PatrickHand";
		var roleWidth = ctx.measureText(role).width;
		ctx.font = "11px PatrickHand";
		var detailLines = _wrapKnowledgeText(ctx, detail, 164, 2);
		var detailWidth = detailLines.reduce(function(max, line){ return Math.max(max, ctx.measureText(line).width); }, 0);
		var tagWidth = Math.min(196, Math.max(88, titleWidth+24, roleWidth+24, detailWidth+24));
		var tagHeight = 43+detailLines.length*13;
		var left = -tagWidth/2;
		var top = -tagHeight/2;

		// A small imperfect label keeps the information attached to the atom,
		// not in a separate dashboard panel.
		ctx.globalAlpha = isFocused ? 0.98 : 0.92;
		_roundRect(ctx, left, top, tagWidth, tagHeight, 8);
		ctx.fillStyle = "#fff";
		ctx.fill();
		ctx.lineWidth = isFocused ? 2.5 : 1.7;
		ctx.strokeStyle = color;
		ctx.stroke();
		ctx.globalAlpha = 0.2;
		_roundRect(ctx, left-1, top+1, tagWidth+2, tagHeight, 8);
		ctx.strokeStyle = "#222";
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.globalAlpha = 1;

		ctx.beginPath();
		ctx.arc(left+10, top+10, 3.5, 0, Math.TAU);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.font = "15px PatrickHand";
		ctx.fillStyle = "#222";
		ctx.textBaseline = "middle";
		ctx.textAlign = "center";
		ctx.fillText(title, 3, top+11);
		ctx.font = "10px PatrickHand";
		ctx.fillStyle = "#777";
		ctx.fillText(role, 3, top+25);
		ctx.font = "11px PatrickHand";
		ctx.fillStyle = "#4d4d4d";
		detailLines.forEach(function(line, index){
			ctx.fillText(line, 3, top+42+index*13);
		});

		ctx.restore();
	}
	self.draw = function(ctx){

		ctx.save();
		ctx.translate(self.x, self.y);

		var s;
		if(s = self.sim.options.scale) ctx.scale(s,s);

		// Circle
		var infectedFrame = self.sim.options.infectedFrame || 1;
		var infectedColor = PEEP_COLORS[infectedFrame];
		var myFrame = self.infected ? infectedFrame : 0;
		var myColor = PEEP_COLORS[myFrame];
		if(self.knowledge){
			var knowledgeState = self.getKnowledgeState();
			var knowledgeFrame = KNOWLEDGE_STATE_FRAMES[knowledgeState];
			if(knowledgeFrame===undefined) knowledgeFrame = 0;
			infectedFrame = knowledgeFrame;
			infectedColor = PEEP_COLORS[knowledgeFrame];
			myFrame = knowledgeFrame;
			myColor = infectedColor;
		}
		// CONCLUSION SPLASH
		if(self.sim.options.CONCLUSION){
			var distance = getVectorLength(self);
			if(distance < self.sim.options.CONCLUSION_GLOW_RADIUS){
				//self.isPastThreshold = true;
				myFrame = self.conclusionFrame;
				infectedFrame = self.conclusionFrame;
			}
		}
		self.sprite.rotation = bodyRotation;
		if(self.knowledge){
			var ringScale = 1 + Math.sin(_knowledgePulse)*0.025;
			ctx.save();
			ctx.scale(ringScale, ringScale);
			ctx.beginPath();
			ctx.arc(0, 0, 29, 0, Math.TAU);
			ctx.globalAlpha = (self.sim.focusedPeep===self) ? 0.65 : 0.34;
			ctx.strokeStyle = myColor;
			ctx.lineWidth = (self.sim.focusedPeep===self) ? 2.6 : 1.5;
			ctx.stroke();
			ctx.restore();
		}
		if(self.isPastThreshold){ // highlight! glow!

			_glowAnim += 0.03;
			var _glowScale = 1 + Math.sin(_glowAnim)*0.04;
			ctx.globalAlpha = 0.35;
			self.sprite.scale = _initSpriteScale*1.25*_glowScale;
			
			self.sprite.gotoFrame(infectedFrame);
			self.sprite.draw(ctx);

			// undo
			ctx.globalAlpha = 1;
			self.sprite.scale = _initSpriteScale;

		}
		self.sprite.gotoFrame(myFrame);
		self.sprite.draw(ctx);

		// Face
		ctx.save();
		ctx.translate(self.faceX, self.faceY);
		self.sprite.rotation = 0;
		self.sprite.gotoFrame(self.faceBlink ? 7 : 6);
		if(self.sim.options._wisdom && self.infected){
			self.sprite.gotoFrame(10);
		}
		if(self.sim.options._bottle && self.infected){
			self.sprite.rotation = Math.sin(_bottleAnim*1.5)*0.15;
		}
		self.sprite.draw(ctx);
		ctx.restore();

		// PROPS?
		if(self.sim.options._bottle && self.infected){
			self.propSprite.x = 25;
			self.propSprite.y = 15;
			_bottleAnim += _bottleSpeed;
			self.propSprite.scale = 0.25;
			self.propSprite.rotation = 0.2 + Math.sin(_bottleAnim)*0.2;
			self.propSprite.gotoFrame(9);
			self.propSprite.draw(ctx);
		}
		if(self.sim.options._dunce && self.infected){
			self.propSprite.x = -14;
			self.propSprite.y = -22;
			self.propSprite.scale = 0.25;
			self.propSprite.gotoFrame(8);
			self.propSprite.draw(ctx);
		}

		_drawKnowledgeBadge(ctx, myColor);
		_drawKnowledgeTag(ctx, myColor);

		//////////////////////////////////////////////////////////
		// LABEL FOR INFECTED/FRIENDS, BAR, AND CONTAGION LEVEL //
		//////////////////////////////////////////////////////////

		// DON'T show bar if simple contagion
		if(self.sim.contagion>0 && !self.sim.semanticSceneID){

			ctx.save();

			// SHAKE
			if(self._shakeAnim>=0){
				var shake = Math.sin(self._shakeAnim*10)*3;
				ctx.translate(shake, 0);
				self._shakeAnim -= 0.05;
			}

			var bgColor = "#ddd";
			var uiColor = "#333";

			// Say: Infected/Friends (% then n/n)
			ctx.translate(0,-46);
			ctx.font = '12px PatrickHand';
			ctx.fillStyle = uiColor;
			ctx.textBaseline = "middle";
			ctx.fontWeight = "bold";
			if(self.numFriends>0){

				// %, centered
				ctx.textAlign = "center";
				var labelPercent = Math.round(100*(self.numInfectedFriends/self.numFriends)) + "%";
				ctx.fillText(labelPercent, 0, 0);

				/*
				// %
				ctx.textAlign = "left";
				var labelPercent = Math.round(100*(self.numInfectedFriends/self.numFriends)) + "%";
				ctx.fillText(labelPercent, -barWidth/2, 0);

				// #/#
				ctx.textAlign = "right";
				var labelNum = self.numInfectedFriends+"/"+self.numFriends;
				ctx.fillText(labelNum, barWidth/2, 0);
				*/


			}else{
				ctx.textAlign = "center";
				ctx.fillText("∅", 0, -1);
			}

			// the gray bg
			ctx.translate(0,13);
			ctx.fillStyle = bgColor;
			ctx.beginPath();
			ctx.rect(-barWidth/2, -barHeight/2, barWidth, barHeight);
			ctx.fill();
			
			// the color fill
			if(self.numFriends>0){
				ctx.fillStyle = infectedColor;
				ctx.beginPath();
				ctx.rect(-barWidth/2, -barHeight/2, barWidth*(self.numInfectedFriends/self.numFriends), barHeight);
				ctx.fill();
			}

			// a pointer for contagion level
			ctx.translate(0, -barHeight/2);
			ctx.save();
				ctx.translate(barWidth*self.sim.contagion - barWidth/2, 0);
				ctx.lineCap = "butt";
				ctx.strokeStyle = uiColor;
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.moveTo(0,-2);
				ctx.lineTo(0,barHeight+2);
				ctx.stroke();
			ctx.restore();

			ctx.restore();

		}

		ctx.restore();

	};

	// Hit Test
	self.hitTest = function(x,y,buffer){
		// ACTUALLY IGNORE BUFFER'S AMOUNT, IT'S TRUE OR FALSE.
		// if(buffer===undefined) buffer=0;
		buffer = !!buffer;
		var dx = self.x-x;
		var dy = self.y-y;
		var dist2 = dx*dx+dy*dy;
		
		var r = radius;
		var s;
		if(s = self.sim.options.scale) r*=s;
		
		r = buffer ? Math.max(r+10, 40) : r;
		
		return (dist2<r*r);

	};

	// Infect
	self.infect = function(){
		self.infected = true;
	};

	// Shake
	self._shakeAnim = -1;
	self.shake = function(){
		self._shakeAnim = 1;
	};

}
