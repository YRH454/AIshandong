/*
 * RHYME knowledge atoms
 *
 * The original crowds simulation gives us a playful, hand-drawn motion
 * language.  This atlas gives selected nodes a learning meaning, so a dot is
 * no longer just "someone in a network": it can be a definition, a condition,
 * an example, a counterexample, or a transferable conclusion.
 *
 * Interaction grammar inspired by Nicky Case's LOOPY (CC0): named nodes,
 * meaningful connections, and compact local explanations instead of a second
 * page of text.  The drawing and lesson data below are RHYME's own adaptation.
 */
(function(){
	"use strict";

	var params = new URLSearchParams(window.location.search);
	var requestedTopic = (params.get("topic") || "").trim().replace(/\s+/g, " ");
	var lessonKey = (params.get("lesson") || "").trim();
	var lessonStorageKey = lessonKey ? "rhyme-explainer:lesson:" + lessonKey : "";

	function compactText(value, limit){
		var text = String(value || "").replace(/\s+/g, " ").replace(/[\u200b-\u200d\ufeff]/g, "").trim();
		if(!text) return "";
		if(limit && text.length>limit) return text.slice(0, Math.max(1, limit-1)).replace(/[，、；;：: ]+$/, "") + "…";
		return text;
	}

	function textSignature(value){
		return compactText(value, 160).toLowerCase().replace(/[^0-9a-z\u4e00-\u9fff]+/g, "");
	}

	function readStoredLesson(){
		if(!lessonStorageKey) return null;
		try{
			var raw = window.sessionStorage.getItem(lessonStorageKey);
			if(!raw) return null;
			var parsed = JSON.parse(raw);
			if(!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length===0) return null;
			return parsed;
		}catch(error){
			return null;
		}
	}

	var storedLesson = readStoredLesson();
	if(storedLesson && compactText(storedLesson.title, 80)){
		requestedTopic = compactText(storedLesson.title, 80);
	}

	function atom(label, role, detail){
		return {
			label: label,
			role: role,
			detail: detail
		};
	}

	function copyAtom(source, config){
		var result = {};
		Object.keys(source || {}).forEach(function(key){ result[key] = source[key]; });
		if(result.state===undefined) result.state = "unlinked";
		if(result.activeState===undefined) result.activeState = "familiar";
		if(result.featured===undefined) result.featured = true;
		config = config || {};
		Object.keys(config).forEach(function(key){ result[key] = config[key]; });
		return result;
	}

	function relation(label, detail, offset){
		return { label:label, detail:detail, offset:offset || [0,0] };
	}

	function createScene(nodes, relationList, config){
		var relations = {};
		relationList = relationList || [];
		relationList.forEach(function(item){
			var key = item.from+"-"+item.to;
			var reverseKey = item.to+"-"+item.from;
			relations[key] = item;
			relations[reverseKey] = item;
		});
		return {
			nodes:nodes,
			relations:relations,
			fallbackRelations:(config && config.fallbackRelations) || [],
			legend: config && config.legend,
			caption: config && config.caption
		};
	}

	function r(from, to, label, detail, offset){
		var result = relation(label, detail, offset);
		result.from = from;
		result.to = to;
		return result;
	}

	function conditionalVocabulary(){
		return {
			universe: atom("样本空间", "总范围", "先列出所有可能结果；条件概率不是从空白开始算。"),
			eventA: atom("事件 A", "目标", "你真正想问的那件事，例如『患病』或『抽到红球』。"),
			conditionB: atom("条件 B", "已知条件", "题目已经告诉你的信息，例如『检测阳性』。它会改变观察范围。"),
			intersection: atom("A∩B", "共同发生", "同时满足目标事件 A 与已知条件 B 的那一部分。"),
			conditional: atom("P(A|B)", "核心判断", "在 B 已发生的前提下，A 发生的比例。"),
			frequency: atom("频数表", "数据证据", "把抽象概率换成具体人数或次数，最容易发现分母有没有变。"),
			normalize: atom("重新归一化", "计算动作", "只在 B 的范围里重新计算比例：P(A∩B) / P(B)。"),
			independence: atom("独立性", "特殊情况", "若 A 与 B 独立，知道 B 不改变 A 的概率；但题目不能默认独立。"),
			counterexample: atom("反例", "边界检查", "找一个『阳性很多但真患病很少』的情境，防止把 P(A|B) 与 P(B|A) 混为一谈。"),
			prior: atom("基率", "先验信息", "事件 A 在总体中原本有多常见；它会影响最终判断。"),
			test: atom("检测结果", "观察证据", "检测阳性只是 B，不等于目标事件 A 已经发生。"),
			bayes: atom("贝叶斯更新", "更新规则", "把基率、检测证据与条件概率合起来，更新对 A 的判断。"),
			newCase: atom("新情境", "迁移", "换一套数字、换一个故事，仍能先找 B，再在 B 内计算 A 的比例。"),
			example: atom("抽球实验", "具体例子", "通过『先抽到某色，再问另一件事』把条件限制看清楚。"),
			conclusion: atom("最终判断", "可解释结论", "答案不仅有数值，还能说清楚分母为何是 P(B)。")
		};
	}

	function calculusVocabulary(){
		return {
			universe: atom("函数图像", "研究对象", "先看量如何随输入变化；每一个局部变化都发生在图像上。"),
			eventA: atom("目标点", "关注位置", "要问的是这个位置附近发生了什么，而不是整张图的平均情况。"),
			conditionB: atom("邻近范围", "限制条件", "把观察窗口缩小到目标点附近。"),
			intersection: atom("割线", "共同信息", "连接两个相近点，得到这一小段的平均变化率。"),
			conditional: atom("导数", "核心判断", "当邻近范围趋近于零时，变化率稳定下来的极限。"),
			frequency: atom("数值表", "数据证据", "用越来越小的步长比较变化率，检查它是否稳定。"),
			normalize: atom("取极限", "计算动作", "不是把除数直接代成零，而是观察它不断靠近零时的趋势。"),
			independence: atom("可导条件", "特殊情况", "尖点、跳跃或竖直切线附近，导数可能不存在。"),
			counterexample: atom("尖点反例", "边界检查", "|x| 在 0 点左右斜率不同，提醒我们不要只看一边。"),
			prior: atom("已有图像", "先验信息", "函数的连续性、对称性和已知结构会帮助判断极限。"),
			test: atom("变化率", "观察证据", "比较不同小步长下的平均变化率。"),
			bayes: atom("局部线性", "更新规则", "一旦导数稳定，就可用切线近似附近的函数变化。"),
			newCase: atom("优化问题", "迁移", "把导数用到最大最小值、速度与边际变化等新情境。"),
			example: atom("切线", "具体例子", "用一条最贴近曲线的直线，把瞬时变化看得见。"),
			conclusion: atom("局部判断", "可解释结论", "能说明某点为什么增、减或驻留，而不是只报一个导数值。")
		};
	}

	function physicsVocabulary(){
		return {
			universe: atom("研究对象", "起点", "先圈出正在研究的物体，别把环境和对象混在一起。"),
			eventA: atom("运动状态", "目标", "问题真正关心的是速度、位移或加速度怎样变化。"),
			conditionB: atom("受力条件", "已知条件", "哪些力正在作用、方向如何，是建立模型的限制。"),
			intersection: atom("受力图", "共同信息", "把对象与外力同时画出来，避免漏力或把内力算进去。"),
			conditional: atom("牛顿定律", "核心判断", "合力决定加速度：先判断合力，再判断运动变化。"),
			frequency: atom("实验数据", "数据证据", "用位移、时间或力的测量来验证模型。"),
			normalize: atom("分解合力", "计算动作", "把复杂力沿合适方向拆开，再合成。"),
			independence: atom("参考系", "特殊情况", "换参考系后描述可能变，但物理关系要保持一致。"),
			counterexample: atom("平衡反例", "边界检查", "有力不等于一定加速；合力为零时仍可能匀速。"),
			prior: atom("初始状态", "先验信息", "初速度、位置与质量决定后续如何展开。"),
			test: atom("可测量量", "观察证据", "只用题目给出的量和单位，建立可检验的关系。"),
			bayes: atom("模型修正", "更新规则", "实验不符时回查受力图、假设与测量误差。"),
			newCase: atom("新场景", "迁移", "把同一受力分析迁移到斜面、圆周或电梯问题。"),
			example: atom("斜面小车", "具体例子", "一个具体情境，帮助把力的方向和运动方向区分开。"),
			conclusion: atom("运动结论", "可解释结论", "结论必须能回到受力图和定律，而不是只写公式答案。")
		};
	}

	function genericVocabulary(){
		var name = requestedTopic || "核心概念";
		return {
			universe: atom("核心概念", "起点", "先说清楚这个主题研究的对象和边界。"),
			eventA: atom("关键问题", "目标", "这次真正要解释、判断或求解的事情。"),
			conditionB: atom("关键条件", "已知条件", "题干中会改变结论的限制，不应被当作背景噪声。"),
			intersection: atom("核心关系", "共同信息", "让定义、条件和对象第一次真正交汇的关系。"),
			conditional: atom(name.length>8 ? name.slice(0,8)+"…" : name, "核心判断", "本次学习的中心概念；它需要被解释，而不只是被重复。"),
			frequency: atom("数据或例子", "数据证据", "用一个具体例子检查抽象关系是否站得住。"),
			normalize: atom("推理步骤", "计算动作", "把条件转化为可执行的推理或计算。"),
			independence: atom("适用范围", "特殊情况", "什么时候这条规则可用，什么时候需要停下来重新判断。"),
			counterexample: atom("反例", "边界检查", "用不成立的情况暴露被忽略的条件。"),
			prior: atom("已有知识", "先验信息", "新内容会接在已经知道的概念和经验上。"),
			test: atom("观察证据", "观察证据", "题目给出的事实、图表或现象。"),
			bayes: atom("验证", "更新规则", "把推理结果和例子、反例对照，必要时修正。"),
			newCase: atom("新情境", "迁移", "换一个题目或场景，仍能沿着关系找到解法。"),
			example: atom("典型例", "具体例子", "一个能把抽象关系看清楚的最小例子。"),
			conclusion: atom("可解释结论", "最终判断", "能说明为什么成立、边界在哪，并可迁移到新问题。")
		};
	}

	function roleForGeneratedScene(scene){
		if(scene && scene.path_role==="remediation") return "易错修正";
		if(scene && scene.path_role==="advanced") return "迁移挑战";
		var phase = scene && scene.continuity && scene.continuity.teaching_phase;
		var phaseRoles = {
			question:"学习问题",
			intuition:"直觉入口",
			mechanism:"作用机制",
			verification:"验证证据",
			boundary:"适用边界",
			synthesis:"迁移结论"
		};
		return phaseRoles[phase] || "知识原子";
	}

	function collectGeneratedAtoms(lesson){
		var atoms = [];
		var seen = {};
		function add(label, role, detail){
			label = compactText(label, 28).replace(/[“”"'`*_#]/g, "").trim();
			var signature = textSignature(label);
			if(!signature || signature.length<2 || seen[signature]) return;
			seen[signature] = true;
			atoms.push(atom(label, compactText(role, 16) || "知识原子", compactText(detail, 150) || "这个知识原子需要和其他线索一起判断。"));
		}
		function addPayload(scene){
			var payload = scene && scene.scene_payload;
			if(!payload || !payload.kind) return;
			var detail = scene.key_point || scene.narration || "";
			switch(payload.kind){
				case "concept-constellation":
					add(payload.core, "核心概念", payload.core_detail || detail);
					(payload.branches || []).forEach(function(branch){ add(branch.label, branch.relation || "关键关系", branch.detail || detail); });
					(payload.boundary_conditions || []).forEach(function(condition){ add(condition, "成立边界", detail); });
					break;
				case "causal-chain":
					add(payload.trigger, "触发条件", detail);
					(payload.steps || []).forEach(function(step){ add(step.label, "过程步骤", step.mechanism || step.effect || detail); });
					add(payload.outcome, "结果", detail);
					(payload.blockers || []).forEach(function(blocker){ add(blocker, "阻断条件", detail); });
					break;
				case "timeline-river":
					(payload.events || []).forEach(function(event){ add(event.title, "阶段变化", event.change || event.impact || detail); });
					break;
				case "comparison-studio":
					add(payload.shared_condition, "共同前提", detail);
					(payload.dimensions || []).forEach(function(dimension){ add(dimension.label, "比较维度", dimension.deciding_factor || detail); });
					break;
				case "system-network":
					(payload.nodes || []).forEach(function(node){ add(node.label, node.role || "系统节点", node.detail || detail); });
					(payload.inputs || []).forEach(function(input){ add(input, "输入", detail); });
					(payload.outputs || []).forEach(function(output){ add(output, "输出", detail); });
					break;
				case "state-machine":
					(payload.states || []).forEach(function(state){ add(state.label, "状态", state.description || detail); });
					break;
				case "case-lab":
					(payload.evidence || []).forEach(function(evidence){ add(evidence.label, "案例证据", evidence.detail || evidence.supports || detail); });
					(payload.reasoning_steps || []).forEach(function(step){ add(step, "推理步骤", detail); });
					add(payload.conclusion, "案例结论", detail);
					(payload.counterevidence || []).forEach(function(item){ add(item, "反向证据", detail); });
					break;
				case "parameter-lab":
					add(payload.parameter_label, "可调参数", detail);
					(payload.thresholds || []).forEach(function(threshold){ add(threshold.label, "临界变化", threshold.effect || detail); });
					(payload.response_points || []).forEach(function(point){ add(point.label, "响应结果", point.result || detail); });
					if(payload.stable_range) add(payload.stable_range.label, "稳定范围", detail);
					break;
			}
		}

		(lesson.scenes || []).forEach(function(scene){
			var role = roleForGeneratedScene(scene);
			addPayload(scene);
			if(scene && scene.storyboard && Array.isArray(scene.storyboard.atoms)){
				scene.storyboard.atoms.forEach(function(item){ add(item, role, scene.storyboard.knowledge_relation || scene.key_point || scene.narration); });
			}
			if(scene && scene.visual && Array.isArray(scene.visual.items)){
				scene.visual.items.forEach(function(item){ add(item, role, scene.key_point || scene.narration); });
			}
			if(scene && scene.stage && Array.isArray(scene.stage.zones)){
				scene.stage.zones.forEach(function(zone){ add(zone.label, zone.role || role, scene.key_point || scene.narration); });
			}
		});

		if(atoms.length<5){
			(lesson.highlights || []).forEach(function(item){ add(item, "关键结论", lesson.summary || ""); });
			(lesson.scenes || []).forEach(function(scene){ add(scene.title, roleForGeneratedScene(scene), scene.key_point || scene.narration); });
		}
		return atoms.slice(0, 32);
	}

	function collectGeneratedRelations(lesson){
		var relations = [];
		var seen = {};
		function add(label, detail){
			label = compactText(label, 22);
			var signature = textSignature(label + " " + compactText(detail, 48));
			if(!label || !signature || seen[signature]) return;
			seen[signature] = true;
			relations.push(relation(label, compactText(detail, 150) || "沿着这条关系继续检查它为什么成立。", [0, 14]));
		}
		function addPayload(scene){
			var payload = scene && scene.scene_payload;
			var fallback = scene && (scene.key_point || scene.narration) || "";
			if(!payload || !payload.kind) return;
			switch(payload.kind){
				case "concept-constellation":
					(payload.branches || []).forEach(function(branch){ add(branch.relation, branch.detail || fallback); });
					(payload.cross_links || []).forEach(function(link){ add(link.label, fallback); });
					break;
				case "causal-chain":
					(payload.steps || []).forEach(function(step){ add(step.mechanism || step.effect || step.label, step.effect || step.observable || fallback); });
					break;
				case "timeline-river":
					(payload.events || []).forEach(function(event){ add(event.change || event.title, event.impact || fallback); });
					break;
				case "comparison-studio":
					(payload.dimensions || []).forEach(function(dimension){ add(dimension.label, dimension.deciding_factor || fallback); });
					break;
				case "system-network":
					(payload.edges || []).forEach(function(edge){ add(edge.label, fallback); });
					(payload.feedback_loops || []).forEach(function(loop){ add(loop.label, fallback); });
					break;
				case "state-machine":
					(payload.transitions || []).forEach(function(transition){ add(transition.trigger, transition.effect || fallback); });
					(payload.exception_paths || []).forEach(function(path){ add(path.trigger, path.effect || fallback); });
					break;
				case "case-lab":
					(payload.evidence || []).forEach(function(evidence){ add(evidence.supports, evidence.detail || fallback); });
					break;
				case "parameter-lab":
					(payload.thresholds || []).forEach(function(threshold){ add(threshold.label, threshold.effect || fallback); });
					break;
			}
		}
		(lesson.scenes || []).forEach(function(scene){
			addPayload(scene);
			if(scene && scene.storyboard) add(scene.storyboard.knowledge_relation, scene.key_point || scene.narration);
			if(scene && scene.continuity) add(scene.continuity.passes, scene.continuity.next_question || scene.key_point);
		});
		return relations.slice(0, 48);
	}

	function buildGeneratedLesson(lesson){
		if(!lesson) return null;
		var atoms = collectGeneratedAtoms(lesson);
		if(atoms.length<5) return null;
		var relations = collectGeneratedRelations(lesson);
		if(relations.length===0) relations.push(relation("建立联系", "把两个知识原子放在一起，再检查它们是否真的相互支持。", [0,14]));
		function chooseAtom(pattern, fallback){
			for(var index=0; index<atoms.length; index++){
				if(pattern.test(atoms[index].label + " " + atoms[index].role + " " + atoms[index].detail)) return atoms[index];
			}
			return atoms[fallback % atoms.length];
		}
		var evidence = chooseAtom(/证据|数据|例|验证|检验|观察/, 2);
		var boundary = chooseAtom(/边界|反例|异常|错误|阻断|限制|条件/, 3);
		var transfer = chooseAtom(/迁移|应用|新题|结论|输出|结果/, atoms.length-1);
		return {
			title:compactText(lesson.title, 56) || requestedTopic || "当前主题",
			summary:compactText(lesson.summary, 160),
			atoms:atoms,
			relations:relations,
			guide:{
				core:compactText(lesson.title, 28) || atoms[0].label,
				entry:atoms[0].label,
				support:atoms[Math.min(1, atoms.length-1)].label,
				evidence:evidence.label,
				boundary:boundary.label,
				transfer:transfer.label,
				relationship:relations[0].label
			}
		};
	}

	function makeGeneratedLessonScenes(lesson){
		var offsets = [[0,-50],[0,48],[0,-48],[0,48],[0,-44],[0,44]];
		function generatedNodes(count, start, state, activeState, visibleCount){
			var nodes = [];
			for(var index=0; index<count; index++){
				var source = lesson.atoms[(start+index)%lesson.atoms.length];
				nodes.push(copyAtom(source, {
					state:state,
					activeState:activeState,
					featured:index<visibleCount,
					labelOffset:offsets[index%offsets.length]
				}));
			}
			return nodes;
		}
		function generatedRelations(start, count){
			var result = [];
			for(var index=0; index<count; index++) result.push(lesson.relations[(start+index)%lesson.relations.length]);
			return result;
		}
		function generatedScene(count, start, state, activeState, caption, visibleCount){
			return createScene(generatedNodes(count, start, state, activeState, visibleCount), [], {
				legend:true,
				caption:caption,
				fallbackRelations:generatedRelations(start, Math.min(12, lesson.relations.length))
			});
		}
		var g = lesson.guide;
		return {
			"network-map":generatedScene(9, 0, "unlinked", "verified", "这张图只放本次讲解真正需要的知识原子。", 9),
			"condition-gate":generatedScene(4, 1, "unlinked", "verified", "从“"+g.entry+"”出发，沿着“"+g.relationship+"”走向核心判断。", 4),
			"familiarity-map":generatedScene(9, 3, "unlinked", "familiar", "红色只代表想起来；还需要证据把它变成理解。", 9),
			"cue-path":generatedScene(10, 5, "unlinked", "familiar", "一条熟悉路径很快，但它还没有经过充分验证。", 7),
			"cue-cascade":generatedScene(15, 7, "unlinked", "familiar", "先让线索出现，再判断它是否真的能解释问题。", 8),
			"evidence-gate":generatedScene(6, 9, "unlinked", "verified", "用“"+g.evidence+"”核对核心关系，而不是只凭熟悉感。", 6),
			"verification-path":generatedScene(6, 11, "unlinked", "verified", "理解需要一条可以被逐步复查的关系链。", 6),
			"verified-cascade":generatedScene(15, 13, "unlinked", "verified", "蓝色代表不同来源的证据已经共同支持这个判断。", 8),
			"prevent-gate":generatedScene(10, 15, "unlinked", "verified", "遇到“"+g.boundary+"”时，先停下来检查关系是否仍然成立。", 7),
			"organization-map":generatedScene(18, 17, "unlinked", "verified", "把零散知识原子组织起来，才不会只剩一串答案。", 8),
			"transfer-bridge":generatedScene(12, 19, "unlinked", "transfer", "带走的是关系和判断方法，不是上一题的现成结论。", 7),
			"transfer-world":generatedScene(18, 21, "unlinked", "transfer", "当“"+g.transfer+"”能在新问题中重新成立，理解才真正可迁移。", 8)
		};
	}

	var generatedLesson = buildGeneratedLesson(storedLesson);

	function getVocabulary(){
		if(generatedLesson) return { id:"generated-lesson", atoms:{}, lesson:generatedLesson };
		if(/条件概率|随机事件|贝叶斯|概率|事件/.test(requestedTopic)) return { id:"conditional-probability", atoms:conditionalVocabulary() };
		if(/导数|微分|积分|极限|函数/.test(requestedTopic)) return { id:"calculus", atoms:calculusVocabulary() };
		if(/受力|牛顿|速度|加速度|运动|物理/.test(requestedTopic)) return { id:"physics", atoms:physicsVocabulary() };
		return { id:"generic", atoms:genericVocabulary() };
	}

	function makeScenes(vocabulary){
		if(vocabulary.lesson) return makeGeneratedLessonScenes(vocabulary.lesson);
		var a = vocabulary.atoms;
		var scene = {};

		scene["network-map"] = createScene([
			copyAtom(a.universe, {labelOffset:[0,-50]}),
			copyAtom(a.eventA, {labelOffset:[0,-48]}),
			copyAtom(a.conditionB, {labelOffset:[0,-48]}),
			copyAtom(a.intersection, {labelOffset:[0,-48]}),
			copyAtom(a.conditional, {labelOffset:[0,-50], activeState:"verified", featured:true}),
			copyAtom(a.frequency, {labelOffset:[0,48]}),
			copyAtom(a.normalize, {labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.independence, {labelOffset:[0,48]}),
			copyAtom(a.counterexample, {labelOffset:[0,48], activeState:"verified"})
		], [
			r(0,1,"确定对象","先分清所有可能结果与目标事件。",[0,-12]),
			r(0,2,"限定范围","已知条件会缩小我们应该观察的范围。",[0,-12]),
			r(1,3,"共同发生","目标事件与条件同时成立的部分。",[0,-12]),
			r(2,3,"筛选","只保留符合条件的情况。",[0,12]),
			r(3,4,"重新归一化","在条件范围内重新计算目标事件的比例。",[0,-12]),
			r(4,5,"用数据验证","把公式转换成人数或次数检查。",[0,12]),
			r(4,6,"计算规则","核心关系落到可执行的计算。",[0,12]),
			r(4,7,"特殊情况","独立性成立时，条件不会改变目标概率。",[0,12]),
			r(4,8,"防止混淆","反例帮我们识别反向条件概率。",[0,12])
		], {legend:true, caption:"一张由 9 个知识原子组成的理解网络"});

		scene["condition-gate"] = createScene([
			copyAtom(a.conditionB, {labelOffset:[0,-52]}),
			copyAtom(a.frequency, {labelOffset:[0,52], activeState:"verified"}),
			copyAtom(a.intersection, {labelOffset:[0,-52], activeState:"verified"}),
			copyAtom(a.conditional, {labelOffset:[0,52], activeState:"verified", featured:true})
		], [
			r(0,2,"先筛选 B","先进入题目已经给出的条件范围。",[0,-18]),
			r(2,3,"再看 A","在 B 内看 A 占了多少。",[0,-18]),
			r(1,2,"用频数核对","用具体人数确认交集没有算错。",[0,18])
		], {legend:true, caption:"条件并非附注，而是一次真正的筛选"});

		scene["familiarity-map"] = createScene([
			copyAtom(a.universe, {labelOffset:[0,-48]}),
			copyAtom(a.eventA, {labelOffset:[0,-48]}),
			copyAtom(a.conditionB, {labelOffset:[0,-48]}),
			copyAtom(a.intersection, {labelOffset:[0,48]}),
			copyAtom(a.conditional, {labelOffset:[0,48], activeState:"familiar", featured:true}),
			copyAtom(a.frequency, {labelOffset:[0,48]}),
			copyAtom(a.independence, {labelOffset:[0,48]}),
			copyAtom(a.counterexample, {labelOffset:[0,-48]}),
			copyAtom(a.newCase, {labelOffset:[0,-48], activeState:"transfer"})
		], [
			r(0,1,"看见过","只产生熟悉感的连接。",[0,-14]),
			r(1,4,"背过公式","知道符号，不等于能解释。",[0,-14]),
			r(2,4,"题干提示","一条同类提示会增强熟悉。",[0,-14]),
			r(4,7,"需要反例","没有反例时，理解还没有被检验。",[0,14]),
			r(4,8,"尚不能迁移","没有验证链条，换题时容易失效。",[0,14])
		], {legend:true, caption:"红色不是『理解』，而是『我好像见过它』"});

		scene["cue-path"] = createScene([
			copyAtom(a.conditionB, {labelOffset:[0,-48], state:"familiar", activeState:"familiar", featured:true}),
			copyAtom(a.eventA, {labelOffset:[0,48], activeState:"familiar"}),
			copyAtom(a.intersection, {labelOffset:[0,-48], activeState:"familiar"}),
			copyAtom(a.conditional, {labelOffset:[0,48], activeState:"familiar", featured:true}),
			copyAtom(a.frequency, {labelOffset:[0,-48], activeState:"familiar"}),
			copyAtom(a.example, {labelOffset:[0,48], activeState:"familiar"}),
			copyAtom(a.normalize, {labelOffset:[0,-48], activeState:"familiar"}),
			copyAtom(a.independence, {labelOffset:[0,48], activeState:"familiar"}),
			copyAtom(a.counterexample, {labelOffset:[0,-48], activeState:"familiar"}),
			copyAtom(a.conclusion, {labelOffset:[0,48], activeState:"familiar"})
		], [
			r(0,1,"答案提示","一句口诀可以很快触发相邻记忆。",[0,-15]),
			r(1,3,"符号联想","看见熟悉公式，感觉像已经会了。",[0,-15]),
			r(3,4,"同类题","重复同一种题型会让红色走得很快。",[0,-15]),
			r(4,6,"套步骤","记住步骤仍可能没理解它为何成立。",[0,15]),
			r(6,9,"得到答案","能得到答案，不等于能解释答案。",[0,15])
		], {legend:true, caption:"一条速记线索可以很快扩散，但它还没有接受验证"});

		var cascadeNodes = [
			copyAtom(a.conditionB, {label:"口诀", role:"速记线索", detail:"把条件概率的计算口诀记下来，能快速启动回忆。", labelOffset:[0,-44], state:"familiar", activeState:"familiar"}),
			copyAtom(a.conditional, {label:"公式", role:"符号记忆", detail:"只记住 P(A|B) 的写法还不够。", labelOffset:[0,-44], activeState:"familiar"}),
			copyAtom(a.example, {label:"典型题", role:"熟题", detail:"同一类例题会让步骤越来越熟悉。", labelOffset:[0,-44], activeState:"familiar", featured:false}),
			copyAtom(a.frequency, {label:"表格", role:"数据线索", detail:"数据表可以支持理解，也可能只被当成答案模板。", labelOffset:[0,44], activeState:"familiar", featured:false}),
			copyAtom(a.eventA, {label:"目标 A", role:"问题对象", detail:"真正要问的事件。", labelOffset:[0,44], activeState:"familiar", featured:false}),
			copyAtom(a.conditionB, {label:"条件 B", role:"筛选条件", detail:"已知条件决定你该站在哪个样本范围里。", labelOffset:[0,-44], activeState:"familiar"}),
			copyAtom(a.intersection, {label:"交集", role:"共同发生", detail:"A 和 B 一起发生的部分。", labelOffset:[0,-44], activeState:"familiar"}),
			copyAtom(a.normalize, {label:"分母", role:"重新计算", detail:"分母从全体变成 B，这是最容易被忽略的一步。", labelOffset:[0,44], activeState:"familiar"}),
			copyAtom(a.prior, {label:"基率", role:"先验", detail:"总体中 A 的常见程度。", labelOffset:[0,44], activeState:"familiar", featured:false}),
			copyAtom(a.test, {label:"检测", role:"证据", detail:"检测阳性是条件，不是最终答案。", labelOffset:[0,-44], activeState:"familiar", featured:false}),
			copyAtom(a.counterexample, {label:"反例", role:"检验", detail:"反例会打断只凭熟悉步骤得到的错觉。", labelOffset:[0,-44], activeState:"verified"}),
			copyAtom(a.bayes, {label:"更新", role:"综合判断", detail:"把基率和证据一起更新判断。", labelOffset:[0,44], activeState:"verified", featured:false}),
			copyAtom(a.newCase, {label:"变式", role:"迁移", detail:"题目换个故事仍能定位条件与分母。", labelOffset:[-48,44], activeState:"transfer"}),
			copyAtom(a.conclusion, {label:"结论", role:"解释", detail:"结论要能说出为什么，不是只报一个数。", labelOffset:[-48,44], activeState:"verified"}),
			copyAtom(a.universe, {label:"范围", role:"总样本", detail:"最终始终要知道你正在谁的范围内算比例。", labelOffset:[0,44], activeState:"verified", featured:false})
		];
		scene["cue-cascade"] = createScene(cascadeNodes, [
			r(0,1,"触发回忆","速记线索先把公式叫出来。",[0,-15]),
			r(1,2,"套入熟题","重复练习让路径变快。",[0,-15]),
			r(5,6,"限定范围","真正的理解仍要回到条件 B。",[0,15]),
			r(6,7,"重新归一化","先筛选，再换分母。",[0,15]),
			r(10,11,"反例校验","反例把熟悉感转成可验证的判断。",[0,15]),
			r(11,12,"迁移","验证后的理解才能跨到变式题。",[0,15])
		], {legend:true, caption:"红色记忆路径很快；蓝色验证路径更慢，但能走到新题"});

		scene["evidence-gate"] = createScene([
			copyAtom(a.counterexample, {labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.frequency, {labelOffset:[0,-52], activeState:"verified"}),
			copyAtom(a.conditionB, {labelOffset:[0,-52], state:"verified", activeState:"verified"}),
			copyAtom(a.intersection, {labelOffset:[0,-52], activeState:"verified"}),
			copyAtom(a.conditional, {labelOffset:[0,48], activeState:"verified", featured:true}),
			copyAtom(a.normalize, {labelOffset:[0,48], activeState:"verified"})
		], [
			r(2,3,"条件筛选","先把 B 当成新的观察范围。",[0,-15]),
			r(3,4,"关系成立","共同发生部分决定条件概率的分子。",[0,-15]),
			r(1,4,"数据核对","用频数检查公式是不是对应事实。",[0,15]),
			r(0,4,"反例校验","能经得住反例，才不只是背熟。",[0,15]),
			r(4,5,"重新归一化","核心判断要落到正确分母。",[0,15])
		], {legend:true, caption:"蓝色表示：定义、条件、例子和反例已经互相验证"});

		scene["verification-path"] = createScene([
			copyAtom(a.conditional, {labelOffset:[0,-52], state:"verified", activeState:"verified", featured:true}),
			copyAtom(a.universe, {labelOffset:[0,-52], activeState:"verified"}),
			copyAtom(a.conditionB, {labelOffset:[0,-52], activeState:"verified"}),
			copyAtom(a.intersection, {labelOffset:[0,52], activeState:"verified"}),
			copyAtom(a.frequency, {labelOffset:[0,52], activeState:"verified"}),
			copyAtom(a.newCase, {labelOffset:[0,52], activeState:"transfer"})
		], [
			r(0,1,"回到范围","先确认总样本空间。",[0,-15]),
			r(1,2,"套入条件","条件 B 把范围缩小。",[0,-15]),
			r(2,3,"找交集","只计数同时满足 A 与 B 的部分。",[0,15]),
			r(3,4,"频数验证","用数据表检查每一步。",[0,15]),
			r(4,5,"迁移判断","换个故事依然能沿这条链找到答案。",[0,15])
		], {legend:true, caption:"蓝色的理解需要多条证据共同到达"});

		scene["verified-cascade"] = createScene(cascadeNodes.map(function(node, index){
			var next = copyAtom(node, { state:"unlinked", activeState:index>=10 ? "transfer" : "verified" });
			if(index===0) next.label = "定义";
			if(index===1) next.label = "条件";
			if(index===2) next.label = "例子";
			if(index===3) next.label = "数据";
			if(index===10) next.label = "反例";
			if(index===12) next.label = "迁移";
			return next;
		}), [
			r(0,1,"定义 + 条件","不同类型的证据共同支撑理解。",[0,-15]),
			r(1,2,"条件 + 例子","例子让抽象定义落地。",[0,-15]),
			r(3,7,"数据 + 计算","数据和步骤应能互相核对。",[0,15]),
			r(10,11,"反例 + 修正","反例不是捣乱，它在保护理解。",[0,15]),
			r(11,12,"验证后迁移","只有经过验证，绿色才会进入变式题。",[0,15])
		], {legend:true, caption:"多条不同来源的证据同时支持，才会变成蓝色理解"});

		scene["prevent-gate"] = createScene([
			copyAtom(a.conditionB, {labelOffset:[0,-48], state:"verified", activeState:"verified"}),
			copyAtom(a.eventA, {labelOffset:[0,-48], activeState:"verified"}),
			copyAtom(a.intersection, {labelOffset:[0,-48], activeState:"verified"}),
			copyAtom(a.conditional, {labelOffset:[0,48], activeState:"verified", featured:true}),
			copyAtom(a.frequency, {labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.counterexample, {labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.prior, {labelOffset:[0,-48], activeState:"verified"}),
			copyAtom(a.test, {labelOffset:[0,-48], activeState:"verified"}),
			copyAtom(a.bayes, {labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.newCase, {labelOffset:[0,48], activeState:"transfer"})
		], [
			r(0,2,"先筛选","不跳过已知条件。",[0,-15]),
			r(2,3,"找核心比例","只在 B 内计算 A。",[0,-15]),
			r(4,3,"用数据复核","数值与公式必须对得上。",[0,15]),
			r(5,3,"用反例复核","防止反向概率的直觉错误。",[0,15]),
			r(8,9,"迁移到变式","新题也能重新走一遍这条检查链。",[0,15])
		], {legend:true, caption:"要阻止『只凭一个线索就下结论』，就为它补上不同类型的验证"});

		scene["organization-map"] = createScene([
			copyAtom(a.universe, {featured:false}),
			copyAtom(a.eventA, {featured:false}),
			copyAtom(a.conditionB, {featured:false}),
			copyAtom(a.intersection, {labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.conditional, {labelOffset:[0,48], activeState:"verified", featured:true}),
			copyAtom(a.frequency, {featured:false}),
			copyAtom(a.conditional, {label:"核心判断", role:"理解起点", detail:"被验证过的核心判断会带动周围的知识原子。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.conditionB, {label:"关键条件", role:"限制范围", detail:"迁移时，先检查新题是否满足同样的关键条件。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.intersection, {label:"核心关系", role:"共同成立", detail:"定义、条件与问题对象在这里真正接上。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.frequency, {label:"数据证据", role:"核对", detail:"数据和例子帮助判断不是凭感觉成立。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.counterexample, {label:"反例检查", role:"边界", detail:"反例负责告诉我们这条理解不能走到哪里。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.newCase, {label:"可迁移结论", role:"走向新题", detail:"当内部关系稳住，结论就可以走出这一组。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.normalize, {label:"推理步骤", role:"组织", detail:"把零散线索排成可重复的推理路径。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.example, {featured:false}),
			copyAtom(a.counterexample, {featured:false}),
			copyAtom(a.prior, {featured:false}),
			copyAtom(a.test, {featured:false}),
			copyAtom(a.conclusion, {featured:false})
		], [
			r(0,1,"对象与问题","先分清研究范围和真正的目标。",[0,-14]),
			r(3,4,"关系支撑","交集关系让核心判断站得住。",[0,14]),
			r(6,7,"组织条件","理解不是散点，条件要接回判断。",[0,14]),
			r(8,9,"用数据核对","关系式与数据证据相互验证。",[0,14]),
			r(10,11,"通过边界","能排除错误，才有资格迁移。",[0,14]),
			r(12,13,"组织成链","有序步骤让理解能被再次使用。",[0,14])
		], {legend:true, caption:"组内组织：让定义、条件、数据和反例互相托住"});

		scene["transfer-bridge"] = createScene([
			copyAtom(a.conditional, {label:"已会的判断", role:"旧知识", detail:"已经被验证过的条件概率判断。", labelOffset:[0,48], state:"verified", activeState:"verified"}),
			copyAtom(a.conditionB, {label:"条件结构", role:"不变部分", detail:"迁移前先判断新题是否有同样的条件结构。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.frequency, {label:"数据表达", role:"旧证据", detail:"旧题中有效的表格、频数或实验表达。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.counterexample, {label:"边界提醒", role:"防误用", detail:"不要把旧结论生搬硬套到条件已经变化的新题。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.normalize, {label:"推理步骤", role:"可复用", detail:"可以带走的不是数值，是定位条件与分母的步骤。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.conclusion, {label:"解释语言", role:"可沟通", detail:"能说清楚为什么，才能检验是否真的迁移。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.newCase, {label:"新题场景", role:"迁移目标", detail:"新的故事、新的数字，但不一定有新的结构。", labelOffset:[0,-48], activeState:"transfer"}),
			copyAtom(a.eventA, {label:"新问题", role:"新的目标", detail:"先在新题中重新确认你真正要问的事件。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.conditionB, {label:"新条件", role:"重新筛选", detail:"不能默认旧题的条件仍然成立。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.intersection, {label:"相同结构", role:"桥墩", detail:"找到新旧题共同的关系，迁移桥才有落点。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.frequency, {label:"新证据", role:"重新核对", detail:"用新题的数据与事实再做一次验证。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.conclusion, {label:"新结论", role:"迁移完成", detail:"结论能在新题中成立，说明你带走的是理解。", labelOffset:[0,48], activeState:"transfer"})
		], [
			r(0,1,"抽取结构","迁移的不是原题答案，而是可复用的条件结构。",[0,-14]),
			r(1,4,"保留步骤","先找条件，再在条件范围内判断。",[0,-14]),
			r(6,9,"找到桥墩","新旧题有相同结构，才可以搭桥。",[0,14]),
			r(9,10,"重新验证","桥的另一端必须接受新证据。",[0,14]),
			r(10,11,"得到新结论","迁移不是复制，是在新题中重建判断。",[0,14])
		], {legend:true, caption:"跨主题桥梁：带走结构与检查方法，而不是原题的答案"});

		scene["transfer-world"] = createScene([
			copyAtom(a.conditional, {labelOffset:[0,48], state:"verified", activeState:"verified", featured:false}),
			copyAtom(a.conditionB, {labelOffset:[0,48], activeState:"verified", featured:false}),
			copyAtom(a.intersection, {labelOffset:[0,48], activeState:"verified", featured:false}),
			copyAtom(a.frequency, {labelOffset:[0,48], activeState:"verified", featured:false}),
			copyAtom(a.counterexample, {labelOffset:[0,48], activeState:"verified", featured:false}),
			copyAtom(a.conclusion, {labelOffset:[0,48], activeState:"verified", featured:false}),
			copyAtom(a.universe, {label:"旧知识域", role:"已组织", detail:"定义、条件、例子和反例在原主题中已经连得足够稳。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.conditionB, {label:"关键条件", role:"可比较", detail:"跨主题时首先比较是否同样受到这个条件限制。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.normalize, {label:"可复用步骤", role:"局部桥", detail:"不是搬运答案，而是搬运思考步骤。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.counterexample, {label:"边界", role:"防误用", detail:"发现结构不同，就需要停下来重新建模。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.example, {label:"典型例", role:"局部支撑", detail:"具体例子帮助把抽象方法重新落地。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.conclusion, {label:"稳固理解", role:"可带走", detail:"一组内部关系稳固后，才有可能通向远处。", labelOffset:[0,48], activeState:"verified"}),
			copyAtom(a.newCase, {label:"新知识域", role:"迁移终点", detail:"换一门课、换一个问题，仍能认出共同的结构。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.eventA, {label:"新问题", role:"重新定位", detail:"新主题也有自己的问题目标。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.conditionB, {label:"新条件", role:"重新筛选", detail:"旧结论能否成立，取决于新条件。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.intersection, {label:"共同结构", role:"远程桥梁", detail:"这条连接让学习不是一座座孤岛。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.frequency, {label:"新证据", role:"再次验证", detail:"迁移后的判断依然要能被事实核对。", labelOffset:[0,48], activeState:"transfer"}),
			copyAtom(a.conclusion, {label:"新结论", role:"可迁移", detail:"绿色代表：它已在新的问题里重新成立。", labelOffset:[0,48], activeState:"transfer"})
		], [
			r(6,8,"组织局部","内部关系紧密，细节才不容易散掉。",[0,14]),
			r(8,11,"建立支撑","步骤、例子与边界共同托住理解。",[0,14]),
			r(12,15,"跨域连接","远处主题之间也能找到共同结构。",[0,14]),
			r(15,16,"重新验证","到新领域后，证据必须重新对齐。",[0,14]),
			r(16,17,"形成新结论","迁移后的理解在新题中再次站稳。",[0,14])
		], {legend:true, caption:"好理解既有局部组织，也有通向新主题的桥梁"});

		return scene;
	}

	var vocabulary = getVocabulary();
	var scenes = makeScenes(vocabulary);
	var progressStorageKey = lessonKey ? "rhyme-explainer:progress:" + lessonKey : "";
	var learningChapters = ["Networks", "Simple", "Complex", "BB", "SmallWorld", "Conclusion"];

	function readLessonProgress(){
		if(!progressStorageKey) return null;
		try{
			var raw = window.sessionStorage.getItem(progressStorageKey);
			return raw ? JSON.parse(raw) : null;
		}catch(error){
			return null;
		}
	}

	function notifyParent(action, payload){
		if(window.parent && window.parent!==window){
			window.parent.postMessage({
				channel:"rhyme-explainer",
				action:action,
				lessonKey:lessonKey,
				payload:payload || {}
			}, window.location.origin);
		}
	}

	function writeLessonProgress(progress, action){
		if(!progressStorageKey) return;
		try{
			progress.updatedAt = Date.now();
			window.sessionStorage.setItem(progressStorageKey, JSON.stringify(progress));
		}catch(error){
			// Progress tracking is a convenience. The learning experience remains
			// usable even when a browser blocks session storage.
		}
		notifyParent(action || "progress", progress);
	}

	function recordLessonChapter(chapter){
		var chapterIndex = learningChapters.indexOf(chapter);
		if(chapterIndex<0) return;
		var current = readLessonProgress() || {};
		var visited = Array.isArray(current.visitedChapters) ? current.visitedChapters : [];
		if(visited.indexOf(chapter)<0) visited.push(chapter);
		current.chapter = chapter;
		current.position = chapterIndex + 1;
		current.total = learningChapters.length;
		current.visitedChapters = visited;
		if(chapter==="Conclusion") current.completed = true;
		writeLessonProgress(current, current.completed ? "complete" : "progress");
	}

	function recordAtomFocus(knowledge){
		if(!knowledge || !progressStorageKey) return;
		var current = readLessonProgress() || {};
		var focused = Array.isArray(current.focusedAtoms) ? current.focusedAtoms : [];
		var label = compactText(knowledge.label, 28);
		if(label && focused.indexOf(label)<0) focused.push(label);
		current.focusedAtoms = focused.slice(-32);
		writeLessonProgress(current, "atom-focus");
	}

	function getResumeChapter(){
		if(!lessonKey || params.get("fresh")) return null;
		var current = readLessonProgress();
		if(!current || current.completed) return null;
		return learningChapters.indexOf(current.chapter)>=0 ? current.chapter : null;
	}

	window.RHYME_KNOWLEDGE_ATOMS = {
		topic: requestedTopic,
		profile: vocabulary.id,
		isGeneratedLesson:!!generatedLesson,
		lesson: generatedLesson ? {
			title:generatedLesson.title,
			summary:generatedLesson.summary,
			atomCount:generatedLesson.atoms.length,
			guide:generatedLesson.guide
		} : {
			title:requestedTopic,
			atomCount:0,
			guide:{
				core:requestedTopic || "核心判断",
				entry:"关键问题",
				support:"关键证据",
				evidence:"例子与证据",
				boundary:"适用边界",
				transfer:"新情境",
				relationship:"关键关系"
			}
		},
		states: {
			unlinked:{ label:"尚未建立关系", color:"#B4B4B4" },
			familiar:{ label:"只记住答案", color:"#F73C50" },
			verified:{ label:"经过多重验证", color:"#86F5FB" },
			transfer:{ label:"能够迁移", color:"#7DE74E" }
		},
		getScene:function(sceneID){ return scenes[sceneID] || null; },
		getResumeChapter:getResumeChapter,
		recordAtomFocus:recordAtomFocus
	};

	if(typeof subscribe==="function"){
		subscribe("slideshow/goto/", function(chapter){ recordLessonChapter(chapter); });
	}

})();
