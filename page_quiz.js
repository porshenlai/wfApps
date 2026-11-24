(function(SCRIPT){

const ExamTitlePage=`
<style>
.quizBar {padding:8px;display:flex;flex-flow:row nowrap;align-items:center;justify-content:space-between;}
.quizBar>div {white-space:nowrap;}
.quizBar [data-h] {color:blue; text-decoration:underline;}
</style>
<section>
	<div class='ac h1'>考試名稱</div><hr/>
	<div class='ac'><button data-h='set:PageNumber:2'>開始考試</button></div>
	<div data-x='quiz:exam' class='hide'>
		<div class='quizBar'>
			<div style='flex:1 1 auto'></div>
			<div data-h='set:PageNumber:prev'>&lArr;</div>
			<div class='section_bookmark'> (<span data-v='text:pn'>0</span>/<span data-v='text:pc'>-</span>) </div>
			<div data-h='set:PageNumber:next'>&rArr;</div>
			<div style='flex:1 1 auto'></div>
			<div data-h='call:quiz:commit:doc:__API__/wks/commit'>&uArr; Commit</div>
		</div>
	</div>
</section>`;

function csv_escape (s) { return s.replaceAll('"','""'); }

SCRIPT.value = class extends Apps.mod_template
{
	constructor (slide) {
		super(slide);
		this.Secret = Apps.Args.quiz_secret || 'practice'
	}	// constructor

	async hash_control (e, a) {	// security coding applied here
		if (!a) a = e.dataset.o;
 		const hash = Array.from(new Uint8Array(await crypto.subtle.digest(
			'SHA-256',
			(new TextEncoder()).encode(`${a}:${e.textContent}:${this.Secret}`)
		))).map(b => b.toString(32).padStart(2, '0')).join('');
		if (e.dataset.kh) return e.dataset.kh === hash;
		e.dataset.kh = hash;
	}	// hash_control 解碼選項比對答案

	async init (elem, qtype) {
		if (elem.classList.contains('mod_quiz')) return;

		const args=(elem.dataset.xl||elem.dataset.x).split(':');
		if (qtype==='exam') {
			console.log('Enter exam mode', this.Secret);
			if (this.Secret==='practice') this.Secret=undefined;
			const Qs=Array.from(this.Slide.E.querySelectorAll('section'))
				.filter((se)=>!!se.querySelector('.mod_quiz_answer'));
			for (let idx=0;idx<Qs.length;idx++) {
				for(let te=elem.firstChild; te; te=te.nextSibling) if (te.nodeType===1) {
					const be = te.cloneNode(true);
					Apps.E(be).put({"pn":1+idx,"pc":Qs.length});
					Qs[idx].appendChild(be);
				}
			}
			return;
		}

		elem.classList.add('mod_quiz');
		elem.dataset.qtype = qtype;
		if (args[1]==='c') return;

		// shuffle opotions
		let te=[],pe=[];
		for (let oe of Array.from(elem.querySelectorAll('[data-o]'))) {
			oe.dataset.h=`call:quiz:answer`;
			oe.classList.add('mod_quiz_answer');
			if (!oe.dataset.kh)
				await this.hash_control(oe);
			delete oe.dataset.o;
			te.push([Math.random(),oe.outerHTML]);
			pe.push(oe);
		}	
		te.sort((a,b)=>a[0]-b[0]);
		pe.forEach((oe,ix)=>(oe.outerHTML=te[ix][1]));
	}	// init 建立問答頁面

	async configure (elem, ...args) {
		return "<ul>"
		+ "<li><button data-h='call:quiz:download:doc:DLC'>下載 DLC</button></li>"
		+ "<li><button data-h='call:quiz:download:doc:HTML'>下載 HTML</button></li>"
		+ "<li><button data-h='call:quiz:download:doc:JSON'>下載 JSON</button></li>"
		+ "<li><button data-h='call:quiz:commit:doc:JSON:/commit'>下載 JSON</button></li>"
		+ "</ul>";
	}	// configure 繪製設定面板

	async check_answer (qe) {
		let qs = Array.from(qe.querySelectorAll('.mod_quiz_answer')), matched = 0, total = 0;

		if (this.Secret) {
			let r = true;
			switch (qe.dataset.qtype) {
			case 's': case 'm':
				for (let oe of qs)
					if (await this.hash_control(oe, 'O')) {
						total += 1;
						if (oe.classList.contains('QS'))
							matched += 1;
					}
				break;
			case 'sort':
				for (let ix=0; ix<qs.length; ix++) {
					total += 1;
					if (await this.hash_control(qs[ix], qs[ix].classList.contains('QS') ? `${ix}` : '-'))
						matched += 1;
				}
				break;
			}
		}
		const p=/QR?/;
		Array.from(qe.classList)
			.filter((s)=>p.exec(s))
			.forEach((s)=>qe.classList.remove(s));

		qe.dataset.score_ratio=matched/total;
		if (qe.querySelector('.QS')) {
			if (matched >= total) 
				qe.classList.add('QRO');
			else if (qe.dataset.qtype==='s')
				qe.classList.add('QR');
		}
		return qe.dataset.score_ratio;
	}	// check_answer 檢驗答案

	async answer (elem) {
		const p=Apps.E(elem).trace('.mod_quiz');
		switch (p.dataset.qtype) {
		case 's':
			return await (async (set)=>{
				Array.from(p.querySelectorAll('.QS'))
					.forEach((e)=>e.classList.remove('QS'));
				if (set) elem.classList.add('QS');
				return await this.check_answer(p);
			})(!elem.classList.contains('QS'));
		case 'm':
			return await (async()=>{
				elem.classList.toggle('QS');
				return await this.check_answer(p);
			})();
		case 'sort':
			return await (async()=>{
				let c=elem.parentNode;
				elem.classList.toggle('QS'); // toggle the flag of this answer
				if (elem.classList.contains('QS'))
					c.insertBefore(elem,c.querySelector('[data-h]:not(.QS)'));
				else c.appendChild(elem);
				return await new Promise((or,oe)=>{
					setTimeout(async ()=>or(await this.check_answer(p)),0);
				});
			})();
		}
	}	// answer 答題

	async getQuizArray (root=document.body) {
		if ('string' === typeof(root))
			try {
				root = {
					"slide" : ()=>Apps.E(elem).trace('section'),
					"doc" : ()=>document.body
				}[root]();
			} catch (x) { root = document.body.querySelector(root); }

		return Array.from(
			root.querySelectorAll('.mod_quiz')
		).filter((e)=>{
			for (e=e.parentNode; root!==e; e=e.parentNode)
				if (e.classList.contains('mod_quiz')) return false;
			return true;
		});
	}	// getQuizArray 取得問題集陣列

	async getHTML (qes) {
		let qs = '';
		const hp = ``
		for (let page of qes)
			qs += '<section>'+page.outerHTML+'</section>\n';
		return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/App/page.js"></script></head><body style='opacity:0'>\n<!--http:\/\/localhost:8080/QZTest.html?quiz_secret=${this.Secret}-->\n${ExamTitlePage}\n${qs}</body></html>`;
	}	// getHTML 轉換題目為 HTML 字串

	async getDLC (qes) {	
		// <DLC Example>
		//	"1","1","YES or NO","","","0-0-0-0-0","3"
		//	"2","1","Pick One","A || B || C || D","","0-0-0-0-0","3"
		//	"3","1,2","Pick more than ONE","A || B || C || D","","1-0-0-0-0","3"
		const r = [];
		for (let e of qes) {
			if (e.dataset.qtype==='c' || e.dataset.qtype==='sort') continue;
			const [de,opts] = [e.cloneNode(true), {ot:[],ans:[]}];
			const os = Array.from(de.querySelectorAll('.mod_quiz_answer'))
			for (let x=0; x<os.length; x++) {
				opts.ot.push(os[x].textContent);
				if (await this.hash_control(os[x],'O')) opts.ans.push(x+1);
				os[x].parentNode.removeChild(os[x]);
			}
			r.push({
				"Q":de.innerHTML.trim(),
				"O":opts.ot,
				"A":opts.ans
			});
		}	// foreach e in qes
		return r.map((q)=>{
			const Q=q.Q.replaceAll('"','""');
			if(q.A.length>1) // 3:多選
				return `"3","${q.A.join(',')}","${csv_escape(q.Q)}","${csv_escape(q.O.join(' || '))}","","0-0-0-0-0","3"`;
			else // 2:單選
				return `"2","${q.A[0]}","${csv_escape(q.Q)}","${csv_escape(q.O.join(' || '))}","","0-0-0-0-0","3"`;
		}).join('\n');
	}	// getDLC 轉換題目為 致理數位學院 CSV 字串

	async getJSON (qes) {
		const ra=async (Qs)=>{
			let qr=[],qe;
			for (qe of Qs) {
				let Q2s = await this.getQuizArray(qe);
				if (Q2s.length<=0)
					qr.push(Array.from(qe.querySelectorAll('.mod_quiz_answer.QS')).reduce((r,e)=>{
						r.push(e.dataset.kh);
						return r;
					},[]));
				else qr.push(await ra(Q2s));
			}
			return qr;
		};
		return JSON.stringify(await ra(qes));
	}	// getJSON 轉換題目為 JSON 字串

	async applyJSON (e,v) {
		if (Array.isArray(v[0])) {
			const sqs = await this.getQuizArray(e);
			console.assert(
				sqs.length===v.length,
				`the length of quiz(${sqs.length}) and answers(${v.length}) not matched.`
			);
			for (let i=0;i<sqs.length;i++)
				await this.applyJSON(sqs[i],v[i]);
		} else {
			for (let a of v)
				await this.answer(e.querySelector(`[data-kh="${a}"]`));
		}
	}

	async download (elme, target, format='DLC') {
		try {
			Apps.B(
				await this[`get${format}`](await this.getQuizArray(target))
			).download(
				window.prompt("請輸入檔名",(new Date()).toISOString()+"."+{
					"DLC":"csv",
					"HTML":"html",
					"JSON":"json"
				}[format])
			);
		} catch (x) { console.log("Error", x); }
	}	// download 下載題目

	async commit (elem, target, url) {
		console.log('commit',url);
		try {
			let rst = await Apps.B(
				await this.getJSON(await this.getQuizArray(target))
			).commit(url);
			alert(rst.status+'\n'+rst.client_ip);
		} catch (x) { console.log("Error", x); }
	}	// commit

	async verify (elem, doc) {
		if ('string' === typeof(doc))
			return console.log("Not implemented:", doc);
		// clear answers
		Array.from(
			document.body.querySelectorAll(".mod_quiz_answer.QS")
		).forEach((e)=>e.classList.remove('QS'));

		// create quiz list
		let qzs=await this.getQuizArray("doc");
		// apply answers to quiz
		for (let i=0; i<qzs.length; i++)
			await this.applyJSON(qzs[i], doc[i]);
	}	// verify

	async getScore (root=document.body, maxscore=100) {
		let qs = Array.from(root.querySelectorAll('.mod_quiz'));
		let score = qs.filter((q)=>q.dataset.qtype!=='c').reduce((s,e) => {
			if (e.dataset.score_ratio!==undefined)
				s[0] += (parseFloat(e.dataset.score_ratio) < 1 ? 0 : 1);
			s[1] += 1;
			return s;
		}, [0,0]);
		score = maxscore*score[0]/score[1];
		return score;
	}	// getScore

	async drawScoreBoard (elem, root) {
		if ('string'===typeof(root))
			root = document.body.querySelector(root);
		console.assert(root,'Root element not found!');

		const D = Apps.D({});
		if (await D.fetch('__API__/wks/list')) {
			const d = D.D.list.reduce((r,v)=>{
				const s=v.split('_');
				if (!r[s[0]]) r[s[0]]=[];
				r[s[0]].push(v);
				return r;
			}, {}); // {..."ip":[..."fn"]}
			let ct=[], sty='font-size:100%;';
			for (let ip of Object.keys(d).sort())
				ct.push(`<li><select style="${sty}">`
					+ d[ip].sort((a,b)=>a<b?1:a>b?-1:0).reduce((ct,v)=>{
						const vs=v.split('_');
						return ct+`<option value="${v}">${vs[0]} ${vs[2]}</option>`
					},'')
					+ `</select><button style="${sty}">&rArr;</button>`
					+ `<input size="5" readonly style="${sty};text-align:right"></input></li>`
				);
			root.innerHTML = '<ul>\n'+ct.join('\n')+'</ul>';

			if (!root.__ClickHandler__)
				root.addEventListener('click', root.__ClickHandler__ = async (btn) => {
					if (btn instanceof Event) {
						btn=btn.target;
						if (btn.textContent!=='⇒') return;
					}
					await (async (bar)=>{
						const D = Apps.D({});
						const K = bar.querySelector('select').value;
						if (await D.fetch('__API__/wks/list?name='+K)) {
							await this.verify(document.body,D.D);
							const score = await this.getScore(document.body,100);
							bar.querySelector("input").value = (Math.floor(score*100)/100);
						}
					})(btn.parentNode);
				});
		}
	}	// drawScoreBoard
};

})(document.currentScript);
