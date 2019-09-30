let openBCHSocket = async function (address, timeout) {
    return new Promise(function(resolve, reject) {
        var query = {
            "v": 3,
            "q": {
                "find": {"out.e.a":address}
            },
            "r": {
              "f": "[ .[] | {txid: .tx.h, sender: .in[0].e.a, output: .out} ]"
            }
        }
        
        var bitsocket = new EventSource('https://bitsocket.bch.sx/s/'+btoa(JSON.stringify(query)))
        
        bitsocket.onmessage = function(event) {
            var event = JSON.parse(event.data);
            if(event.type == 'mempool') {
                resolve(event);
            }
        }
        
        setTimeout(function(){
            reject('false');
        }, (timeout * 60000));
    });
}

let openSLPSocket = function (slpaddress, tokenid, timeout) {

    return new Promise(function(resolve, reject) {
        var bchquery = {
            "v": 3,
            "q": {
                "find": {"out.e.a": slpaddress, "slp.detail.tokenIdHex": tokenid}
            },
            "r": {
              "f": "[ .[] | {txid: .tx.h, sender: .in[0].e.a, valid: .slp.valid, outputs: .slp.detail.outputs} ]"
            }
        }
        
        var bitsocket = new EventSource('https://slpsocket.fountainhead.cash/s/'+btoa(JSON.stringify(bchquery)))
        
        bitsocket.onmessage = function(event) {
            var event = JSON.parse(event.data);
            if(event.type == 'mempool') {
                resolve(event);
            }
        }
        
        setTimeout(function(){
            reject('false');
        }, (timeout * 60000));
    });
}