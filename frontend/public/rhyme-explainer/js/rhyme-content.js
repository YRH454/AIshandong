(function () {
	"use strict";

	function escapeHTML(value){
		var node = document.createElement("span");
		node.textContent = value;
		return node.innerHTML;
	}

	var params = new URLSearchParams(window.location.search);
	var atlas = window.RHYME_KNOWLEDGE_ATOMS || {};
	var lesson = atlas.lesson || {};
	var guide = lesson.guide || {};
	var requestedTopic = (lesson.title || params.get("topic") || "").trim().replace(/\s+/g, " ");
	var topic = requestedTopic.length > 34 ? requestedTopic.slice(0, 34) + "…" : requestedTopic;
	var safeTopic = escapeHTML(topic);
	var topicLine = safeTopic ? "当前主题：" + safeTopic : "一场关于理解如何发生的互动推演";
	function guideText(key, fallback){
		var value = String(guide[key] || fallback || "").trim();
		return escapeHTML(value.length>28 ? value.slice(0, 27) + "…" : value);
	}
	var guideCore = guideText("core", "核心判断");
	var guideEntry = guideText("entry", "关键问题");
	var guideSupport = guideText("support", "关键线索");
	var guideEvidence = guideText("evidence", "例子与证据");
	var guideBoundary = guideText("boundary", "适用边界");
	var guideTransfer = guideText("transfer", "新情境");
	var guideRelationship = guideText("relationship", "关键关系");
	var resumeChapter = atlas.getResumeChapter && atlas.getResumeChapter();

	/*
	 * The simulation and its interaction grammar are intentionally left as the
	 * original explorable experience.  Only the story spoken by each scene is
	 * adapted from crowds and social contagion to RHYME's knowledge journey.
	 */
	var words = {
		preloader_title: `
			<div style="font-size: 30px;">
				<span style="font-size: 92px;line-height: 78px;position: relative; display:block;">RHYME</span>
				<span>让</span><br>
				<span style="font-size: 58px;letter-spacing: 3px;">知识</span>
				<span style="position:relative;top: -10px;">真正</span>
				<span style="font-size: 58px;">连起来</span><br>
			</div>
			<div style="color:#999; margin-top: 10px;">
				${topicLine}<br>
				互动知识推演 · RHYME
			</div>`,
		preloader_button: `<next></next>`,
		preloader_loading: `正在准备画面…`,
		preloader_play: `${resumeChapter ? "继续推演" : "开始推演"} <div class="rarr"></div>`,

		intro: `
			<br><br>
			你可能也有过这样的时刻：
			<br>
			一个定义明明背得很熟，换一个题目，
			<br>
			它却突然像从没见过一样陌生。
			<br><br>
			因为“看见过”不是“理解了”。
			<br>
			真正的理解，要让一个概念能在新的情境里找到位置。
			<next>从一条连接开始 <div class="rarr"></div></next>`,
		intro_2: `
			<div style="height:0.5em"></div>
			知识不会安静地躺在一页笔记里。
			<br>
			它会和例子、问题、旧经验相遇，
			<br>
			有时被误记，有时被验证，最后才可能成为
			<br>
			能带走、能使用的理解。
			<div style="height:0.8em"></div>
			<b>所以，别只看一个概念；也看看它和谁相连。</b>
			<next>来画一张理解网络 <div class="rarr"></div></next>`,

		networks_tutorial_start: `<b>先看“${guideCore}”这张由知识原子组成的网络。</b><br><span style="font-size:.78em;color:#777">单击原子看局部说明；从一个原子拖到另一个原子，建立关系。</span>`,
		networks_tutorial_connect: `拖拽两个原子，把“${guideEntry}”和“${guideSupport}”之间的关系补出来。`,
		networks_tutorial_disconnect: `从空白处拖过一条线，可以擦去不成立的联系。`,
		networks_tutorial_end: `如果你画好了，<next wiggle>继续看看 <div class="rarr"></div></next>`,
		networks_threshold: `${guideCore} 的关键不在背一句结论。<br>先看清 <b>${guideEntry}</b>，再沿着 <b>${guideRelationship}</b> 走到 <b>${guideSupport}</b>。`,
		networks_threshold_instruction: `<b>单击原子，看看“${guideEvidence}”如何让关系站得住；再启动推演。 <div class="rarr"></div></b>`,
		networks_threshold_end: `<next>明白了</next>`,
		networks_pre_puzzle: `但“连接感”也会骗人。<br>一个概念如果只和熟悉的词挨在一起，很容易让人误以为：我已经懂了。`,
		optional_reading: ``,
		networks_pre_puzzle_2: `
			想象一个概念反复出现在同一种题型里。
			<br>
			你会越来越熟悉它，却未必能在不同条件下使用它。
			<br><br>
			现在，试着亲手制造这种“熟悉错觉”。
			<next>开始布置 <div class="rarr"></div></next>`,
		networks_puzzle: `<b style="font-size:2em">小挑战！</b><br>画出连接，让每个节点都觉得“这个概念我见过”。<icon name="yellow"></icon><br>但别急着把它当成真正理解。`,
		networks_puzzle_metric: `<b>被熟悉感覆盖：</b>`,
		networks_puzzle_metric_2: `还差 9 个节点`,
		networks_puzzle_end: `做到了。你让很多节点都产生了“我懂了”的感觉。<br>可它们只接到了一种线索。<next wiggle>那还不算理解</next>`,
		networks_post_puzzle: `
			这就是学习里的<b>熟悉错觉</b>：看过、听过、划过重点，都可能让人觉得自己已经掌握。
			<br><br>
			要把熟悉变成理解，知识还得经受变化、对照和检验。
			<next>先看看最快的记忆方式 <div class="rarr"></div></next>`,

		simple_simple: `
			先把画面放得最简单：<b>${guideEntry}</b> 这个红色线索出现了。
			<br>
			它可能是一句口诀、一个现象，或一道题里最显眼的答案。
			<br>
			它沿着已经存在的连接，很快被反复看见。
			<br><span style="font-size:.8em;color:#777">红色表示：它被记住了，但还没有被充分验证。</span><br><b>开始推演 <div class="darr"></div></b>`,
		simple_simple_2: `快速想起“${guideEntry}”不是坏事。<br>只是“想起来”还不自动等于能解释“${guideRelationship}”为什么成立。`,
		simple_simple_end: `<next wiggle>继续看</next>`,
		simple_cascade: `很好。<b>再来一个挑战。</b><br>调整连接并启动推演，让“${guideRelationship}”沿着不同知识原子走出去。<br>（有些粗线代表已经很难被忽略的旧经验。）`,
		simple_cascade_end: `<next wiggle>看到了 <div class="rarr"></div></next>`,
		simple_post_cascade: `
			这种快速扩散可以叫做<b>记忆级联</b>：一个答案沿着提示一路复制。
			<br><br>
			但理解不是复制。多数概念不会因为看了一次就真正站稳；它需要多个方向同时来支撑。
			<next wiggle>这就是“多重验证” <div class="rarr"></div></next>`,

		complex_complex: `
			回到“${guideCore}”这个关键判断。这一次，不是看见一个提示就接受它。
			<br><br>
			只有当它同时接到“${guideEvidence}”、例子或边界检查等足够多的线索时，它才愿意说：“我理解了。”
			<br><br><b>先猜一猜，然后运行推演 <div class="rarr"></div></b>`,
		complex_complex_2: `
			<span style="line-height:1.3em; display:block;">
			一个提示只能带来熟悉；多个彼此吻合的线索，才会带来确认。
			<br><br>
			靠近起点的节点更容易先接到足够的证据；连接很多、但线索单一的节点反而会停在“还不确定”。
			<br><br>
			<b>理解的门槛，看的是支持它的证据是否足够多样。</b>
			<next>那就让理解继续长出来</next>
			</span>`,
		complex_complex_3: `
			现在有一个蓝色知识原子。
			它不想只背一句结论，而想把“${guideCore}”用到“${guideTransfer}”里。
			<br><br>
			给它搭上不同类型的连接：一个定义、一个具体例子、一个反例，或一次回忆。
			<br><br><b>&larr; 让每个节点获得足够的理解支撑。</b>`,
		complex_complex_3_end: `
			<span style="line-height:1.3em; display:block;">
			<b>注意：</b>深理解不是把知识变复杂，而是让它经得住变化。
			<br>
			能解释、能举例、能排除错误答案、能迁移到新题的知识，都需要不止一次接触。
			<br><br>
			现在，用这个规则再挑战一次。
			<next>回到网络 <div class="rarr"></div></next>
			</span>`,
		complex_cascade: `还记得这张网络吗？这次蓝色理解 <icon name="blue"></icon> 需要多个支撑才会继续。<br><b>让所有节点都获得足够的理由 <div class="darr"></div></b>`,
		complex_cascade_feel_free: `（可以多次运行，换一种连法再试。）`,
		complex_cascade_end: `<next wiggle>继续 <div class="rarr"></div></next>`,
		complex_post_cascade: `你可能会想：那我只要不断加连接，理解就一定会更快吗？<br>不一定。连接的质量和方向，同样重要。`,
		complex_post_cascade_end: `<next wiggle>试一个反向实验 <div class="rarr"></div></next>`,
		complex_prevent: `如果你直接运行，蓝色理解 <icon name="blue"></icon> 会顺利连到每个节点。<br>现在反过来：<b>把“${guideBoundary}”接进来，阻止“只凭一个线索就下结论” <div class="darr"></div></b>`,
		complex_prevent_2: `看见了吗？<br>更多相似的线索，可能强化熟悉感；<br><b>但如果没有对照、反例和解释，它们并不会自动变成理解。</b><br>这也是为什么刷很多同类题，有时依然不会做变式。`,
		complex_prevent_end: `<next wiggle>继续看看学习小组 <div class="rarr"></div></next>`,
		complex_groupthink: `
			一个学习小组里，每个人都很认真，却可能一起卡在同一种错误思路里。
			<br><br>
			当所有连接都只回到同一个答案，反例和不同方法就很难被听见。
			<br><br>
			所以，理解网络既要有稳定的内部支撑，也要能接到新视角。
			<next>组织 &amp; 迁移 <div class="rarr"></div></next>`,

		bonding_1: `&larr; 连接太少，概念之间互相托不住。<br>连接只在同一条思路里打转，也会卡住。 <div class="rarr"></div>`,
		bonding_2: `<b>画出一个刚好的内部网络：<br>让一条需要多重支撑的理解可以在组内站稳。<div class="darr"></div></b>`,
		bonding_end: `很好。组内把概念、例子和方法织在一起，叫做<b>组织</b>。<br>但如果它只能在这一组里成立呢？<next wiggle>还需要一座桥</next>`,
		bridging_1: `不同主题之间的连接，就是<b>迁移的桥</b>。<br>它让你把“${guideCore}”带到“${guideTransfer}”里。<br><b>画一座桥，让蓝色理解走到另一组：</b>`,
		bridging_end: `和组织一样，桥也要刚好。<br>太窄，旧知识带不过去；只有照搬，没有对照，也会误用。<br><next wiggle>现在把两种连接一起画出来</next>`,
		bb_1: `<b style="font-size:2em">最后一个挑战！</b><br>在组内画出理解支撑，在组间搭出迁移桥梁，<br>让同一个想法能在整张图里走通：`,
		bb_2: `完成了。你画出了一张很特别的学习网络：<br>它既能稳住细节，也能走向新问题。<next wiggle>这就是可迁移的理解 <div class="rarr"></div></next>`,
		bb_small_world_1: `<i>“记住、理解、迁移。”</i><br>好的学习不是只囤积知识点；<br><b>它让局部的细节连得牢，也让远处的主题有路可走。</b>`,
		bb_small_world_2: `不是这个…<br>（因为知识彼此孤立）`,
		bb_small_world_3: `也不是这个…<br>（因为所有线索都挤成一种声音）`,
		bb_small_world_4: `…而是这一张：`,
		bb_small_world_5: `
			当一张学习网络同时有局部组织和跨主题桥梁，它就能支持<b>理解迁移</b>。
			<br><br>
			你不必死记每一条路径；只要在遇到新问题时，知道怎样沿着关系去找答案。
		`,
		bb_small_world_end: `<next>把它收束成一句话 <div class="rarr"></div></next>`,

		sandbox_caption: `（现在，轮到你亲手试试这张理解网络。）`,
		sandbox_contagion: `理解门槛：`,
		sandbox_contagion_simple: `一个线索`,
		sandbox_contagion_complex: `多个线索`,
		sandbox_color_chooser: `理解颜色：`,
		sandbox_tool_chooser: `选择工具：`,
		sandbox_tool_pencil: `画连接`,
		sandbox_tool_add: `添加概念`,
		sandbox_tool_add_infected: `添加起点`,
		sandbox_tool_move: `移动概念`,
		sandbox_tool_delete: `删除概念`,
		sandbox_tool_clear: `<b>全部清除</b>`,
		sandbox_shortcuts_label: `（…或者使用快捷键！）`,
		sandbox_shortcuts: `[1]: 添加概念 &nbsp;&nbsp; [2]: 添加起点<br>[空格]: 移动 &nbsp;&nbsp; [退格键]: 删除`,

		conclusion_1: `
			<div style="font-size: 30px;">总而言之，这一切都在说…</div>
			<div style="width: 100%; position: absolute; font-size: 66px; top: 20px; line-height: 100px; display:block;">连接 &amp; 验证</div>
			<div style="width: 610px; position: absolute; top: 125px; left: 280px;">
				<b>连接：</b>让定义、例子、问题和旧经验彼此看得见。它们不是一串孤立的答案，而是可以互相指路的关系。
			</div>
			<div style="width: 610px; position: absolute; top: 270px; left: 280px;">
				<b>验证：</b>别只问“我见过吗”，还要问“我能解释吗、能举例吗、换一个条件还成立吗”。
			</div>
			<div style="width: 360px; position: absolute; top: 420px; left: 190px; text-align: center; color: #999;">（想继续玩？点击下面的 ★ 知识沙盒 ★）</div>
			<div style="width: 350px; position: absolute; top: 410px; right: 0px; text-align: right;">所以，一条知识什么时候才真正属于你？</div>
			<div style="width: 300px; position: absolute; top: 470px; right: 0px;"><next>当它能走向新的问题。</next></div>`,
		conclusion_2: `
			<span style="line-height:1.4em; display:block;">
				<div style="height:0.5em"></div>
				从记住到理解，再到迁移，
				<br>这不是把更多内容塞进脑子里，
				<br>而是不断补上关系、证据与新的入口。
				<div style="height:0.8em"></div>
				下一次学习时，给自己三个问题：
				<br>它和什么相连？为什么成立？
				<br>换到哪里还能用？
				<div style="height:0.8em"></div>
				<next>把知识连成你自己的网络。</next>
			</span>`,
		conclusion_3: `<i>“教育不是注满一桶水，而是点燃一把火。”</i><br><span style="position:relative; top:5px">~</span> 常被归于 W. B. Yeats<div style="height:0.8em"></div><next small>&lt;3</next>`,
		credits: `
			<div style="text-align:center; color:#fff; letter-spacing: 1px; font-size: 24px; line-height: 27px;">
				<span style="color:#777; position:relative; top:5px;">互动知识体验</span>
				<div style="font-size: 3em; line-height: 1.0em;">RHYME</div>
				<span style="color:#aaa;">把知识连成能走得通的理解</span>
				<br><br>
				<span style="color:#777; position:relative; top:5px; display: inline-block; margin-top: 15px;">原互动底座</span>
				<div style="font-size: 1.75em; line-height: 1.1em; margin: 5px 0;">The Wisdom and/or Madness of Crowds</div>
				<a target="_blank" href="https://github.com/ncase/crowds" style="text-decoration:none">Nicky Case · CC0 1.0</a>
				<br><br>
				<span style="color:#999; font-size:.75em;">RHYME 叙事改编与本地化。素材与音频说明见 THIRD_PARTY_NOTICES.md。</span>
			</div>`,
		WIN: `理解已连通`,
		sim_start: `开始推演`,
		sim_stop: `重置并再试`,
		translations_exist: `RHYME 当前提供：`,
		translations_do_not_exist: `目前提供简体中文体验。`,
		translations_add: `简体中文（当前）`
	};

	Object.keys(words).forEach(function(id){
		var node = document.querySelector("words#" + id);
		if(node) node.innerHTML = words[id];
	});

	document.title = safeTopic ? "RHYME · " + topic + "的互动推演" : "RHYME · 知识如何连接与理解";
	var shareTitle = document.querySelector("#share_title");
	var shareDescription = document.querySelector("#share_desc");
	if(shareTitle) shareTitle.textContent = document.title;
	if(shareDescription) shareDescription.textContent = "RHYME 的互动知识推演：看见概念如何连接、验证与迁移。";

	/* This static adaptation is Chinese-only; do not let the inherited translation
	   control point at the original project's unadapted language pages. */
	window.TRANSLATIONS = [];
	window.ADD_YOUR_OWN_LINK = ".";

	var returnLink = document.querySelector("#rhyme_return");
	if(returnLink && window.parent && window.parent !== window){
		returnLink.addEventListener("click", function(event){
			event.preventDefault();
			window.parent.postMessage({ channel:"rhyme-explainer", action:"close" }, window.location.origin);
		});
		window.addEventListener("keydown", function(event){
			if(event.key === "Escape"){
				window.parent.postMessage({ channel:"rhyme-explainer", action:"close" }, window.location.origin);
			}
		});
	}
})();
