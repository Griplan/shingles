/** UI capabilities are not server authorization. Unknown environments fail closed. */
export type AppEnvironment="develop"|"trial"|"release"|"unknown";
const LOCAL={bodyView:true,manualAnnotation:true};
const POLICY=Object.freeze({
 develop:Object.freeze({...LOCAL,referenceMatching:true,aiSegmentation:true,aiPlacement:true,atlasDebug:true,coordinateDebug:true}),
 trial:Object.freeze({...LOCAL,referenceMatching:true,aiSegmentation:true,aiPlacement:true,atlasDebug:false,coordinateDebug:false}),
 release:Object.freeze({...LOCAL,referenceMatching:false,aiSegmentation:false,aiPlacement:false,atlasDebug:false,coordinateDebug:false}),
 unknown:Object.freeze({...LOCAL,referenceMatching:false,aiSegmentation:false,aiPlacement:false,atlasDebug:false,coordinateDebug:false}),
});
export function environmentOf(account:unknown):AppEnvironment {
 if(!account||typeof account!=="object")return "unknown";
 const mini=(account as {miniProgram?:{envVersion?:unknown}}).miniProgram;
 const value=mini&&typeof mini==="object"?mini.envVersion:undefined;
 return value==="develop"||value==="trial"||value==="release"?value:"unknown";
}
export function currentEnvironment():AppEnvironment {try{return environmentOf(wx.getAccountInfoSync());}catch{return "unknown";}}
export function capabilities(account:unknown){return POLICY[environmentOf(account)];}
export function currentCapabilities(){return POLICY[currentEnvironment()];}
export function canUseDeveloperTools():boolean {return currentCapabilities().coordinateDebug;}
