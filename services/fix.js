const tls = require("tls");
const moment = require("moment");
const crypto = require("crypto");
const assert = require("assert");
const EventEmitter = require("events");

const Prop = {
    BeginString: "8",
    BodyLength: "9",
    CheckSum: "10",
    ClOrdID: "11",
    CumQty: "14",
    ExecID: "17",
    ExecInst: "18",
    LastPx: "31",
    LastQty: "32",
    MsgSeqNum: "34",
    MsgType: "35",
    OrderID: "37",
    OrderQty: "38",
    OrdStatus: "39",
    OrdType: "40",
    OrigClOrdID: "41",
    Price: "44",
    RefSeqNum: "45",
    SenderCompID: "49",
    SendingTime: "52",
    Side: "54",
    Symbol: "55",
    TargetCompID: "56",
    Text: "58",
    TimeInForce: "59",
    TransactTime: "60",
    ListID: "66",
    AllocID: "70",
    NoOrders: "73",
    RawDataLength: "95",
    RawData: "96",
    EncryptMethod: "98",
    OrdRejReason: "103",
    HeartBtInt: "108",
    MaxFloor: "111",
    TestReqID: "112",
    NoMiscFees: "136",
    MiscFeeAmt: "137",
    MiscFeeCurr: "138",
    MiscFeeType: "139",
    ResetSeqNumFlag: "141",
    ExecType: "150",
    LeavesQty: "151",
    CashOrderQty: "152",
    RefTagID: "371",
    RefMsgType: "372",
    SessionRejectReason: "373",
    ListStatusType: "429",
    ListOrderStatus: "431",
    CxlRejResponseTo: "434",
    MassCancelRequestType: "530",
    MassCancelResponse: "531",
    MassCancelRejectReason: "532",
    TotalAffectedOrders: "533",
    Username: "553",
    MatchType: "574",
    WorkingIndicator: "636",
    PriceDelta: "811",
    TargetStrategy: "847",
    TradeID: "1003",
    AggressorIndicator: "1057",
    TriggerType: "1100",
    TriggerAction: "1101",
    TriggerPrice: "1102",
    TriggerPriceType: "1107",
    TriggerPriceDirection: "1109",
    ContingencyType: "1385",
    ListRejectReason: "1386",
    ReqID: "6136",
    StrategyID: "7940",
    DropCopyFlag: "9406",
    RecvWindow: "25000",
    SelfTradePreventionMode: "25001",
    CancelRestrictions: "25002",
    NoLimitIndicators: "25003",
    LimitType: "25004",
    LimitCount: "25005",
    LimitMax: "25006",
    LimitResetInterval: "25007",
    LimitResetIntervalResolution: "25008",
    TriggerTrailingDeltaBips: "25009",
    NoListTriggeringInstructions: "25010",
    ListTriggerType: "25011",
    ListTriggerTriggerIndex: "25012",
    ListTriggerAction: "25013",
    ClListID: "25014",
    OrigClListID: "25015",
    ErrorCode: "25016",
    CumQuoteQty: "25017",
    OrderCreationTime: "25018",
    WorkingFloor: "25021",
    TrailingTime: "25022",
    WorkingTime: "25023",
    PreventedMatchID: "25024",
    PreventedExecutionPrice: "25025",
    PreventedExecutionQty: "25026",
    TradeGroupID: "25027",
    CounterSymbol: "25028",
    CounterOrderID: "25029",
    PreventedQty: "25030",
    LastPreventedQty: "25031",
    SOR: "25032",
    OrderCancelRequestAndNewOrderSingleMode: "25033",
    CancelClOrdID: "25034",
    MessageHandling: "25035",
    ResponseMode: "25036",
    UUID: "25037",
    OrderRateLimitExceededMode: "25038",
};

const FlipProp = flipKeyValue(Prop);

const MessageType = {
    Logon: "A",
    Heartbeat: "0",
    TestRequest: "1",
    Logout: "5",
    NewOrderSingle: "D",
    OrderCancelRequest: "F",
    OrderCancelReject: "9",
    MassOrderCancelRequest: "q",
    MassOrderCancelReport: "r",
    OrderStatusRequest: "H",
    ExecutionReport: "8",
    Reject: "3",
};

const FlipMessageType = flipKeyValue(MessageType);

const BodyLengthPlaceHolder = "__%%BODYLENGTH%%__";
const NoneBodyProp = ["BeginString", "BodyLength", "CheckSum"];
const Separator = "\x01";

class BinanceFixClient extends EventEmitter {
    constructor(options = {}) {
        super();
        this.publicKey = options.publicKey;
        this.privateKey = crypto.createPrivateKey(options.privateKey);

        this.ignoreUnknowMessage = options.ignoreUnknowMessage;
        this._connected = false;
        this._connecting = false;
        this._socket = null;
        this._authenticated = false;
    }

    //------- common metods -----------

    /**
     * New Order Single
     * @param {object} args 需要填的参数包括： ClOrdID，Symbol，OrdType，OrderQty，Price，Side，TimeInForce，ExecInst
     */
    newOrder(args) {
        let msg = Object.assign(
            {},
            {
                MsgType: MessageType.NewOrderSingle,
                ClOrdID: "",
                OrderQty: 0,
                OrdType: "2",
                ExecInst: "6",
                Price: 0,
                Side: "",
                Symbol: "",
            },
            args
        );
        this.send(msg);
    }

    /**
     * Order Cancel Request
     * @param {*} args 需要填的参数：OrderID ， OrigClOrdID 二选一
     */
    cancelOrder(args) {
        let msg = Object.assign(
            {},
            {
                MsgType: MessageType.OrderCancelRequest,
            },
            args
        );
        this.send(msg);
    }

    /**
     * Mass Order Cancel Request
     * @param {*} args 需要填的参数：MassCancelRequestType, ClOrdID, Symbol
     */
    cancelMassOrder(args) {
        let msg = Object.assign(
            {},
            {
                MsgType: MessageType.MassOrderCancelRequest,
                MassCancelRequestType: "7",
            },
            args
        );
        this.send(msg);
    }

    /**
     * Order Status Request
     * @param {*} args 需要填的参数：OrderID,OrigClOrdID 二选一； IncludeFillInfo;
     */
    getOrderStatus(args) {
        let msg = Object.assign(
            {},
            {
                MsgType: MessageType.OrderStatusRequest,
            },
            args
        );
        this.send(msg);
    }

    /**
     * 订阅消息
     * @param {*} callback (message)
     */
    onMessage(callback) {
        this.on("message", (msg) => {
            callback(msg);
        });
    }

    //-------- properties ------------
    get connected() {
        return this._connected;
    }

    get authenticated() {
        return this._authenticated;
    }

    get MessageType() {
        return MessageType;
    }

    //--------- methods ---------------

    connect() {
        if (this._connected || this._connecting) {
            return;
        }
        this._connecting = true;

        let that = this;
        this._socket = tls.connect(
            {
                host: "fix-oe.binance.com",
                port: 9000,
                minVersion: "TLSv1.2",
            },
            () => {}
        );

        this._socket.setEncoding("utf8");
        this._socket.on("connect", () => {
            that._onConnected();
        });
        this._socket.on("data", (data) => {
            that._onReceiveData(data);
        });
        this._socket.on("end", () => {
            // let autoConnect = that.authenticated
            that._onDisconnected();

            // if (autoConnect) {
            console.info("Try to reconnect Binance fix connection");
            that.reconnect();
            // }
        });
        this._socket.on("error", (err) => {
            that._onDisconnected();
            that.emit("error", err);
        });
    }

    reconnect() {
        return this.connect();
    }

    logon() {
        let msg = {
            MsgType: MessageType.Logon,
            SenderCompID: "EXAMPLE",
            TargetCompID: "SPOT",
            RawDataLength: 0, // //占位，后面会补
            RawData: "", //占位，后面会补
            EncryptMethod: 0, // Required to be 0.
            HeartBtInt: 30,
            ResetSeqNumFlag: "Y", // Required to be Y.
            Username: this.publicKey,
            MessageHandling: 2, // 1:UNORDERED, 2: SEQUENTIAL
        };
        this.send(msg);
    }

    sendTestRequest() {
        // console.debug('send fix TestRequest')
        this.send({
            MsgType: MessageType.TestRequest,
            TestReqID: moment.utc().format("YYYYMMDD-HH:mm:ss.SSS"),
        });
    }

    sendHeartbeat(id) {
        // console.debug('send fix Heartbeat')
        this.send({
            MsgType: MessageType.Heartbeat,
            TestReqID: id || moment.utc().format("YYYYMMDD-HH:mm:ss.SSS"),
        });
    }

    send(message) {
        if (!this._connected) {
            console.warn(
                "Binance Fix Connection not ready yet, ignore this send options"
            );
            return;
        }

        let msg = Object.assign(
            {},
            {
                BeginString: "FIX.4.4", // 8
                BodyLength: BodyLengthPlaceHolder, // 9
                MsgType: "", // 35, 需要被覆盖
                MsgSeqNum: this._nextMsgSeqNum(), // 34
                SenderCompID: "EXAMPLE", // 49, 需要被覆盖
                SendingTime: moment.utc().format("YYYYMMDD-HH:mm:ss.SSS"), // 52
                TargetCompID: "SPOT", // 56
            },
            message
        );

        if (msg.MsgType === MessageType.Logon) {
            const tobeSign = [
                msg.MsgType,
                msg.SenderCompID,
                msg.TargetCompID,
                msg.MsgSeqNum,
                msg.SendingTime,
            ].join(Separator);

            // 签名
            const signature = crypto.sign(
                null,
                Buffer.from(tobeSign),
                this.privateKey
            );
            const sign = signature.toString("base64");
            msg.RawDataLength = sign.length;
            msg.RawData = sign;

            msg.Username = this.publicKey;
        }

        let header = `${Prop.BeginString}=${msg.BeginString}${Separator}${Prop.BodyLength}=${msg.BodyLength}${Separator}`;
        let body = "";
        for (let k in msg) {
            if (!Prop[k]) {
                throw new Error(
                    `Binance Client not yet define the property: ${k}`
                );
            }
            if (NoneBodyProp.indexOf(k) > -1) {
                continue;
            }
            body = `${body}${Prop[k]}=${msg[k]}${Separator}`;
        }
        header = header.replace(BodyLengthPlaceHolder, body.length.toString());
        let encode = `${header}${body}`;
        let tail = `${Prop.CheckSum}=${calCheckSum(encode)}${Separator}`;
        encode = `${encode}${tail}`;
        // console.debug('send message', msg)
        //console.debug("encode message:", encode);
        //process.exit();
        this._socket.write(encode);
    }

    _nextMsgSeqNum() {
        return ++this._msgSeqNum;
    }

    _onConnected() {
        //console.info("Binance FIX Server connected success.");
        this._connected = true;
        this._connecting = false;
        this._msgSeqNum = 0;

        this.logon();
        let that = this;
        this._heartbeatId = setInterval(() => {
            that.sendHeartbeat();
        }, 8e3);
    }

    _onDisconnected() {
        console.info("Binance Fix ends connection");
        this._connected = false;
        this._connecting = false;
        this._authenticated = false;
        if (this._heartbeatId) {
            clearInterval(this._heartbeatId);
            this._heartbeatId = null;
        }
    }

    _onReceiveData(data) {
        //console.debug(data);
        if (!data || data.length == 0) {
            console.warn("invalid fix data");
            return;
        }
        let resp = {};
        try {
            let pairs = data.split(Separator);
            for (let pair of pairs) {
                let tmp = pair.split("=");
                if (!tmp.length || tmp.length < 2) {
                    continue;
                }
                let key = tmp[0].toString(),
                    value = tmp[1].toString();
                let pName = FlipProp[key];
                assert(
                    pName,
                    `Fix data decode error. \nUnknow tag: '${key}'; \nRecived data: ${data}`
                );
                resp[pName] = value;
            }
            assert(
                resp.MsgType,
                `Invalid fix data, MsgType is required. Recived data: ${data}`
            );
            assert(
                resp.MsgSeqNum,
                `Invalid fix data, MsgSeqNum is required. Recived data: ${data}`
            );

            let msgTypeStr = FlipMessageType[resp.MsgType];
            if (msgTypeStr) {
                resp._MsgTypeString = msgTypeStr;
            }
            this._handleReceivedMessage(resp);
        } catch (err) {
            if (this.ignoreUnknowMessage) {
                console.warn(err.message);
            } else {
                throw err;
            }
        }
    }

    _handleReceivedMessage(message) {
        // console.debug('receive fix message', message)
        if (message.MsgType === MessageType.TestRequest) {
            this.sendHeartbeat(message.TestReqID);
            // console.debug('receive TestRequest Message, send back Heartbeat')
            return;
        } else if (message.MsgType === MessageType.Heartbeat) {
            // console.debug('received Heartbeat Message')
            return;
        } else if (message.MsgType === MessageType.Logon) {
            this._authenticated = true;
            this.emit("connect", null, message);
            return;
        } else if (message.MsgType === MessageType.Reject) {
            if (message.RefMsgType === MessageType.Logon) {
                this._authenticated = false;
                this.emit("connect", new Error("logon failed"), null);
            } else {
                this.emit("message", message);
            }
            return;
        } else if (message.MsgType === MessageType.Logout) {
            //logout 后会自动关闭socket，触发end事件，此处不需要处理
            return;
        } else if (message.MsgType === MessageType.ExecutionReport) {
            let status = "";
            if (message.OrdStatus === "0") {
                status = "NEW";
            } else if (message.OrdStatus === "4") {
                status = "CANCELED";
            } else {
                status = message.OrdStatus;
            }
            console.log(
                `SPEED ${message.Symbol} ${
                    message.ClOrdID
                } CB${status} ${Date.now()}`
            );
        } else {
            this.emit("message", message);
        }
    }
}

function calCheckSum(buff) {
    for (var idx = 0, cks = 0; idx < buff.length; cks += ord(buff[idx++])) {}

    var sum = cks % 256;

    switch (sum.toString().length) {
        case 1:
            sum = "00" + sum;
            break;
        case 2:
            sum = "0" + sum;
            break;
    }

    return sum;
}

function ord(str) {
    var code = str.charCodeAt(0);

    // High surrogate (could change last hex to 0xDB7F to treat high private surrogates as single characters)
    if (0xd800 <= code && code <= 0xdbff) {
        var hi = code;
        if (str.length === 1) {
            return code;
            // we could also throw an error as it is not a complete character, but someone may want to know
        }
        var low = str.charCodeAt(1);
        return (hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
    }

    // Low surrogate
    if (0xdc00 <= code && code <= 0xdfff) {
        return code;
        // we could also throw an error as it is not a complete character, but someone may want to know
    }
    return code;
}

function flipKeyValue(obj) {
    let tmp_ar = {};

    for (let key in obj) {
        tmp_ar[obj[key]] = key;
    }

    return tmp_ar;
}

function convertToUTCTimestamp(dateTimeString) {
    // 将字符串拆分为日期和时间部分
    const [datePart, timePart] = dateTimeString.split("-");

    // 解析日期部分
    const year = datePart.substr(0, 4);
    const month = datePart.substr(4, 2);
    const day = datePart.substr(6, 2);

    // 解析时间部分
    const [hours, minutes, seconds] = timePart.split(":");
    const [secondsPart, milliseconds] = seconds.split(".");

    // 创建 UTC Date 对象
    const date = new Date(
        Date.UTC(
            parseInt(year),
            parseInt(month) - 1, // 月份是从0开始的，所以要减1
            parseInt(day),
            parseInt(hours),
            parseInt(minutes),
            parseInt(secondsPart),
            parseInt(milliseconds)
        )
    );

    // 获取时间戳（毫秒）
    return date.getTime();
}

module.exports = BinanceFixClient;
