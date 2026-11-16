export function coverageText(value:number):string {
 if(value===0)return "0%";if(value===1)return "100%";
 if(value<0.0001)return "<0.01%";if(value>0.9999)return ">99.99%";
 return `${(value*100).toFixed(2)}%`;
}
