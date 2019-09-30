// Depending on your cache settings this should hopefully make image loading a bit more seamless
cacheimg = new Image();
cacheimg.src="/assets/img/success.svg";
cacheimg2 = new Image();
cacheimg2.src="/assets/img/slp_generic.svg";

let listen4BCH = function (address, expected_amount) {
    openBCHSocket(address, 5).then(function(event) {
        let amount = 0;
        event.data[0].output.forEach(element => {
            console.log(element);
            if(element.e.a == address) {
                amount = (amount + (Number(element.e.v) / 100000000));
            }
        });

        if(amount < (expected_amount * 0.98)) {
            document.getElementById('qrcode').innerHTML = '<img src="/assets/img/error.svg">';
            document.getElementById('payment_status').innerHTML = 'Received less than requested, customer owes you ' + (expected_amount - amount).toFixed(8);
        } else {
            document.getElementById('qrcode').innerHTML = '<img src="/assets/img/success.svg">';
            document.getElementById('payment_status').innerHTML = 'Payment Confirmed';
            document.getElementById('qrcode').style.marginTop = '4vh';
            document.getElementById('payment_confirmed').style = 'background: rgb(63, 199, 139);position: fixed;z-index: 1000;top: 0;left: 0;height: 100%;width: 100%;color: #fff;';
        }
    }).catch(function(err) {
        console.error(err);
        document.getElementById('qrcode').innerHTML = '<img src="/assets/img/error.svg">';
        document.getElementById('payment_status').innerHTML = 'Invoice Timed Out';
    });
}

let listen4SLP = function (address, tokenid, expected_amount) {
    var cashaddress = bchaddr.toCashAddress(address).substring(12);
    openBCHSocket(cashaddress, 5).then(function(event) {
        document.getElementById('qrcode').innerHTML = '<img src="/assets/img/pending.svg">';
        document.getElementById('payment_status').innerHTML = 'Pending SLP Validation...';
        document.getElementById('qrcode').style.marginTop = '4vh';
        document.getElementById('payment_confirmed').style = 'background: rgb(18, 161, 216);position: fixed;z-index: 1000;top: 0;left: 0;height: 100%;width: 100%;color: #fff;';
    }).catch(function(err) {
        console.error(err);
        document.getElementById('qrcode').innerHTML = '<img src="/assets/img/error.svg">';
        document.getElementById('payment_status').innerHTML = 'Invoice Timed Out';
    });
    openSLPSocket(address, tokenid, 5).then(function(event) {
        let amount = 0;
        event.data[0].outputs.forEach(element => {
            if(element.address == address) {
                amount = (amount + Number(element.amount));
            }
        });

        if(amount < (expected_amount * 0.98)) {
            document.getElementById('qrcode').innerHTML = '<img src="/assets/img/error.svg">';
            document.getElementById('payment_status').innerHTML = 'Received less than requested, customer owes you ' + (expected_amount - amount);
        } else {
            document.getElementById('qrcode').innerHTML = '<img src="/assets/img/success.svg">';
            document.getElementById('payment_status').innerHTML = 'Payment Confirmed';
            document.getElementById('qrcode').style.marginTop = '4vh';
            document.getElementById('payment_confirmed').style = 'background: rgb(63, 199, 139);position: fixed;z-index: 1000;top: 0;left: 0;height: 100%;width: 100%;color: #fff;';
        }
    }).catch(function(err) {
        console.error(err);
        document.getElementById('qrcode').innerHTML = '<img src="/assets/img/error.svg">';
        document.getElementById('payment_status').innerHTML = 'Invoice Timed Out';
    });
}


let openPayment = async function (address = null, amount = null) {

    if(document.querySelector('input[name="crypto"]:checked')) {
        var currency = document.querySelector('input[name="crypto"]:checked');
    } else {
        var currency = {
            id: 'bch',
            value: 'bch'
        }
    }
    var profile = JSON.parse(localStorage.getItem('profile'));
    var prices = JSON.parse(localStorage.getItem('prices'));

    if(address == null && currency.id == 'bch') {
        var address = profile.cashaddress;
        var address_human = profile.cashaddress;
    } else if(address == null && currency.id !== 'bch') {
        var address = profile.slpaddress;
        var address_human = profile.slpaddress;
    }
    
    if(address.substring(0,12) == 'bitcoincash:') { var address = address.substring(12); }
    if(amount == null) { var amount = document.getElementById('payment_amount_input').value; }

    if(amount !== null && amount !== '' && amount !== '0') {
        document.getElementById('loading').style.display = 'block';
        var qr = qrcode(0, 'L');
        if(currency.id == 'bch') {
            var amount = (amount / prices['bitcoin-cash'][profile.currency]).toFixed(8);
            qr.addData(address_human+'?amount='+amount);
        } else if (currency.id !== 'bch') {
            qr.addData(address_human+'?amount1='+amount+'-'+currency.id);
        }
        qr.make();

        if(currency.id !== 'bch') {
            listen4SLP(address, currency.id, amount);
        } else {
            listen4BCH(address, amount);
        }
        
        return fetch('/views/payment.ejs').then((response) => response.text()).then((view) => {
            document.getElementById('main_wrap').innerHTML = ejs.compile(view)({qrcode: qr.createSvgTag(), address: address, amount: amount, currency: currency.value});
            document.getElementById('loading').style.display = 'none';
        }).catch(error => console.error('Oopsie: '+error));
    } else {
        alert('Please enter an amount.');
    }
}

let loadView = async function (view, params) {
    document.getElementById('loading').style.display = 'block';
    return fetch('/views/'+view+'.ejs').then((response) => response.text()).then((view) => {
        document.getElementById('main_wrap').innerHTML = ejs.compile(view)(params);
        document.getElementById('loading').style.display = 'none';
    }).catch(error => console.error('Oopsie: '+error));
}

let searchTokens = async function (element) {
    var token_name = element.value;
    if(token_name !== '') {
    var query = {
        "v": 3,
        "q": {
            "db": ["t"],
            "find": {
            "$or": [
                {"tokenDetails.tokenIdHex": token_name},
                {"tokenDetails.name": { "$regex": "^"+token_name+".*", "$options": "i" }},
                {"tokenDetails.symbol": {"$regex": "^"+token_name+".*","$options": "i"}}
            ]
            },
            "sort": {
                "tokenStats.qty_valid_txns_since_genesis": -1
            },
            "limit": 5
        }
    }

    return fetch('https://slpdb.fountainhead.cash/q/'+btoa(JSON.stringify(query))).then((response) => response.json()).then((response) => {
        document.getElementById('token_container').innerHTML = '';
        response.t.forEach(element => {
            document.getElementById('token_container').innerHTML += '<div class="token_box" onclick="addToken(\''+element.tokenDetails.tokenIdHex+'\', \''+element.tokenDetails.symbol+'\');document.getElementById(\'selected_tokens\').appendChild(this)"><img src="https://tokens.bch.sx/64/'+element.tokenDetails.tokenIdHex+'.png" onerror="this.onerror=null;this.src=\'/assets/img/slp_generic.svg\';"><div class="token_info"><p>TICKER: '+element.tokenDetails.symbol+'</p><p>TokenID: '+element.tokenDetails.tokenIdHex.substring(0, 12)+'...'+element.tokenDetails.tokenIdHex.substring(59)+'</p></div></div>';
        });
    }).catch(error => console.error('Oopsie: '+error));
    } else {
        document.getElementById('token_container').innerHTML = '';
    }
}

let transactionHistBCH = async function (address) {
    var query = {
        "v": 3,
        "q": {
          "aggregate": [
            {
              "$match": {
                "out.e.a":address
              }
            },
            {
              "$match": {
                "in.e.a": {
                  "$ne": address
                }
              }
            },
            {
              "$unwind": "$out"
            },
            {
              "$match": {
                "out.e.a": address
              }
            },
            {
              "$limit": 50
            }
          ]
        },
        "r": {
          "f": "[ .[] | {txid: .tx.h, sender: .in[0].e.a, output: .out, block: .blk?} ]"
        }
    }

    return fetch('https://bitdb.bch.sx/q/'+btoa(JSON.stringify(query))).then((response) => response.json()).then((response) => {
        return response;
    }).catch(error => console.error('Oopsie: '+error));
}

let openTransactionHist = async function (address) {
    if(address.substring(0,12) == 'bitcoincash:') { var address = address.substring(12); }
    transactionHistBCH(address).then(function(response) {
        loadView('history', {response: response});
    })
}

let storeProfile = function (name, cashaddress, slpaddress, currency) {
    var profile = {
        name: name,
        cashaddress: cashaddress,
        slpaddress: slpaddress,
        currency: currency
    }

    localStorage.setItem('profile', JSON.stringify(profile));
}

let createProfile = function (settings = null) {
    var name = document.getElementById('store_name').value;
    var cashaddress = document.getElementById('cashaddress').value;
    var slpaddress = document.getElementById('slpaddress').value;
    var currency = document.getElementById('fiat_currency').value;
    
    if(name !== '' && cashaddress !== '') {
        if(settings == null) {
            document.getElementById('merchant_profile').style.display = 'none';
            document.getElementById('token_settings').style.display = 'block';
        }
        storeProfile(name, cashaddress, slpaddress, currency);
    } else {
        alert('Make sure you\'ve filled out all the fields and that addresses are correct. Cashaddresses start with a bitcoincash: prefix');
    }
}


let addToken = function (tokenid, name) {
    if(localStorage.getItem('tokens')) {
        var tokens = JSON.parse(localStorage.getItem('tokens'));
        var tokenids = JSON.parse(localStorage.getItem('tokenids'));
        if(!tokenids.includes(tokenid)) {
            tokens.push({tokenid: tokenid, name: name});
            tokenids.push(tokenid);
            localStorage.setItem('tokens', JSON.stringify(tokens));
            localStorage.setItem('tokenids', JSON.stringify(tokenids));
        }
    } else {
        var tokens = [{tokenid: tokenid, name: name}];
        var tokenids = [tokenid];
        localStorage.setItem('tokens', JSON.stringify(tokens));
        localStorage.setItem('tokenids', JSON.stringify(tokenids));
    }
}

let updatePrices = async function () {
    var url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd,aed,ars,aud,bdt,bhd,bmd,brl,cad,chf,clp,cny,czk,dkk,eur,gbp,hkd,huf,idr,ils,inr,jpy,krw,kwd,lkr,mmk,mxn,myr,nok,nzd,php,pkr,pln,rub,sar,sek,sgd,thb,try,twd,uah,vef,vnd,zar,xdr,xag,xau';
    return fetch(url).then((response) => response.json()).then((response) => {
        localStorage.setItem('prices', JSON.stringify(response));
    }).catch(error => console.error('Oopsie: '+error));
}

let updateCoin = function (element) {
    if(element.value == 'bch') {
        var profile = JSON.parse(localStorage.getItem('profile'));
        document.getElementById('current_coin').innerHTML = profile.currency.toUpperCase();
    } else {
        document.getElementById('current_coin').innerHTML = element.value;
    }
}

let addNumber = function (element) {
    document.getElementById('payment_amount_input').value += element.value;
}

let delNumber = function (amount) {
    var prune = -amount;
    var numberInput = document.getElementById('payment_amount_input');
    numberInput.value = numberInput.value.slice(0, prune);
}

//openPayment('qr54r2t5rq6f3sfj9sysxvr02f9dljr00g7ze2xasq', '0.0001');

if(!localStorage.getItem('profile')) {
    loadView('setup', {});
} else {
    loadView('dashboard', {})
}

updatePrices();

setInterval(function(){
    updatePrices();
}, 20000);