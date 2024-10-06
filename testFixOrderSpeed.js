const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const BinanceFixClient = require("./services/fix");
const { v4: uuidv4 } = require("uuid");
const { log } = require("./utils/log");
const symbol = "BNBUSDT";

const fixClient = new BinanceFixClient({
    publicKey:
        "fF1u29YTnrxqhxIRe7c9EyqekYsIP6vGuNOOZf4UzfLC2oOxCCYvZKreqglL8xVy",
    privateKey:
        "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIE8GXIpHKuRM4Sxbdxy9KGomP9CiTLT8mKJpgy++bHX1\n-----END PRIVATE KEY-----",
    ignoreUnknowMessage: true,
});

const genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const main = async () => {
    fixClient.connect();
    await sleep(1000);
    scheduleLoopTask(async () => {
        const clientOrderId = genClientOrderId();
        const start = Date.now();
        // 下单
        console.log(`${clientOrderId} NEWSUBMIT ${Date.now()}`);
        fixClient.newOrder({
            ClOrdID: clientOrderId,
            OrderQty: "0.01",
            OrdType: "2", // LIMIT
            ExecInst: "6", // PARTICIPATE_DONT_INITIATE
            Price: "500",
            Side: "1", // BUY
            Symbol: symbol,
        });
        console.log(`${clientOrderId} NEWSUBMITTED ${Date.now()}`);
        // console.log(`NEW ${Date.now()-start}`)
        await sleep(1000);
        // 撤单
        console.log(`${clientOrderId} CANCELSUBMIT ${Date.now()}`);
        fixClient.cancelOrder({
            ClOrdID: clientOrderId,
            OrigClOrdID: clientOrderId,
            Symbol: symbol,
        });
        console.log(`${clientOrderId} CANCELSUBMITTED ${Date.now()}`);
        await sleep(1000);
        process.exit();
    });
};
main();
