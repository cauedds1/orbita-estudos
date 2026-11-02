// Test-only transport: never contacts OpenAI and never uses a real key.
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(input,options){
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url!=='https://api.openai.com/v1/responses')return originalFetch(input,options);
 if(options.body.includes('TEST_GENERATION_TIMEOUT'))throw new DOMException('Timed out','TimeoutError');if(options.body.includes('TEST_GENERATION_QUOTA'))return Response.json({error:{code:'insufficient_quota'}},{status:429});
 const request=JSON.parse(options.body);const format=request.text?.format;
 const body=JSON.stringify(request.input);const english=body.includes('Equivalent fractions represent the same amount.');const source=english?'Equivalent fractions represent the same amount.':'Frações equivalentes representam a mesma quantidade.';
 const q=(prompt='O que representam frações equivalentes?')=>({prompt,options:['A mesma quantidade','Quantidades sempre distintas','Números sem relação','Apenas números inteiros'],answer:'A mesma quantidade',explanation:'A divisão pode mudar sem mudar a quantidade representada.'});
 let text;
 if(!format)text='Imagine uma pizza: metade de uma pizza representa a mesma quantidade que duas de quatro fatias iguais. Por isso, 1/2 = 2/4. Como você representaria metade usando oito fatias?';
 else if(format.name==='fast_mission')text=JSON.stringify({summary:'Revise frações equivalentes.',topics:[{title:'Frações equivalentes',reason:'Conceito central do material.',source,evidence:'Conceito central'}],coverageNote:'Missão de teste baseada no material.',scopeMatch:'sem_escopo',questions:[{...q(),source,topicTitle:'Frações equivalentes'}]});
 else if(format.schema.properties.title)text=JSON.stringify({title:'Frações equivalentes',summary:'Entenda representações diferentes da mesma quantidade.',keyPoints:['A quantidade pode ser a mesma.','Multiplique numerador e denominador pelo mesmo número.','Compare quantidades.'],sections:[{heading:'Entendendo a fração',body:'Uma fração representa partes de um todo.',example:'Uma de duas partes iguais é 1/2.'},{heading:'Equivalência',body:'Frações equivalentes representam a mesma quantidade.',example:'1/2 equivale a 2/4.'},{heading:'Comparando',body:'Use o mesmo denominador para comparar.',example:'1/2 = 2/4, que é menor que 3/4.'}],questions:[q(),q('Que relação existe entre 1/2 e 2/4?')]});
 else if(format.name==='topic_learning')text=JSON.stringify({questions:[q('Que ideia permite dividir as fatias sem mudar a quantidade?'),q('Qual alternativa descreve a equivalência de frações?')]});
 else text=JSON.stringify({summary:'Frações equivalentes representam a mesma quantidade.',questions:[{...q(),source},{...q('O que muda quando dividimos uma pizza em mais fatias?'),source}]});
 return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});
};
