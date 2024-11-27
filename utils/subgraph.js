const gql = require("graphql-tag");
const { EvmChain } = require("@moralisweb3/common-evm-utils");
const { ethers } = require("ethers");
const { minProfit, winRate, minPnl, APPOLO } = require("../config/config.js");

const provider = ethers.getDefaultProvider(
  "https://mainnet.infura.io/v3/a4319123753b432894ab65c23fa47186"
);


async function getPool(
  launchtime,
  minlp,
  maxlp,
  minbuys,
  minsells,
  version,
  endTo,
  chain = EvmChain.ETHEREUM
) {
  const startFrom = Math.floor((Date.now() - launchtime * 60 * 1000) / 1000);

  const minTx = Number(minbuys) + Number(minsells);
  const queryv3 = `
    {
        pools(first:100,where:{createdAtTimestamp_gt:${startFrom},
                    createdAtTimestamp_lt:${endTo},
                    totalValueLockedETH_lt:${maxlp},
                    totalValueLockedETH_gt:${minlp},
                    txCount_gt:${minTx}},
                    orderBy: createdAtTimestamp ,orderDirection:desc, subgraphError: allow) {
            id
            token0{
              id
              symbol
              name
              decimals
            }
            token1{
              id
              symbol
              name
              decimals
            }
            totalValueLockedETH
            totalValueLockedToken0
            totalValueLockedToken1
            createdAtTimestamp
            txCount
            mints{
                amount0
                amount1
                timestamp
            }
            swaps(first:1,orderBy:timestamp,orderDirection:asc){
                timestamp
            }
          
        }   
  }
  `;
  const queryv2 = `
  {
        pairs(first:100,where:{
            createdAtTimestamp_gt:${startFrom},
            reserveETH_gt:${Number(minlp) * 2},
            reserveETH_lt:${Number(maxlp) * 2},
            txCount_gt:${minTx}},
            orderBy: createdAtTimestamp ,
            orderDirection:desc, subgraphError: allow){
          id
          token0{
            id
            symbol
            name
            decimals
          }
          
          token1{
            id
            symbol
            name
            decimals
          }
          totalSupply
          reserveETH
          reserve0
          reserve1
          createdAtTimestamp
          txCount
          mints{
            amount0
            amount1
            timestamp
          }
          swaps(first:1,orderBy:timestamp,orderDirection:asc){
            timestamp
          }
    }
      }
  `;
  const query = gql(version.toString() == 2 ? queryv2 : queryv3);
  const chainId = Number(chain._value);
  const appoloClient = APPOLO(chainId, version);
  let newpool = [];
  try {
    const data0 = await appoloClient.query({
      query: query,
    });
    const pools = data0?.data?.pairs ? data0?.data?.pairs : data0?.data?.pools;
    pools?.map((pool) => {
      newpool.push({
        id: pool.id,
        token0: pool.token0,
        token1: pool.token1,
        totalSupply: pool.totalSupply ? pool.totalSupply : 0,
        reserveETH: pool.reserveETH
          ? Number(pool.reserveETH) / 2
          : pool.totalValueLockedETH,
        txCount: pool.txCount,
        reserve0: pool.reserve0 ? pool.reserve0 : pool.totalValueLockedToken0,
        reserve1: pool.reserve1 ? pool.reserve1 : pool.totalValueLockedToken1,
        createdAtTimestamp: pool.createdAtTimestamp,
        version: version,
        mints: pool.mints,
        firstswaps: pool.swaps[0].timestamp,
      });
    });
  } catch (error) {
    console.error("Error:", error);
  }
  return newpool;
}

async function get_token_price(token_address, pool_address, version) {
  if (version == 3) {
    const query2 = `
    query {
      swaps(first:1, orderDirection:desc,orderBy:timestamp,
        where:{pool:"${pool_address}"}){
          token0 {
            id
            symbol
          }
          token1 {
            id
            symbol
          }
          amount0
          amount1
          amountUSD
      }
    }`;
    const appoloClient = APPOLO(1, version);
    try {
      const data0 = await appoloClient.query({
        query: gql(query2),
      });
      const pool_data = data0.data.swaps[0];
      let value = 0;
      if (pool_data.token0.id == token_address) {
        value = pool_data.amountUSD / pool_data.amount0;
      } else {
        value = pool_data.amountUSD / pool_data.amount1;
      }
      return Math.abs(value);
    } catch (error) {
      console.error("Error:", error);
      return 0;
    }
  } else {
    const query1 = `
    query {
        tokenDayDatas(first:1,orderBy:date,orderDirection:desc,where:{token:"${token_address}"})
        {
            priceUSD
        }
    }        
    `;
    let value = 0;
    try {
      const appoloClient = APPOLO(1, version);
      const data0 = await appoloClient.query({
        query: gql(query1),
      });
      data0?.data?.tokenDayDatas.map((data) => {
        value = Number(data.priceUSD);
      });
    } catch (error) {
      console.error("Error:", error);
    }
    return value;
  }
}

async function get_token_price_eth(token_address, pool_address, version) {
  let valueToken = 0;
  let valueEth=0;
  const appoloClient = APPOLO(1, version);

  if (version == 3) {
    const query2 = `
    query {
      swaps(first:1, orderDirection:desc,orderBy:timestamp,
        where:{pool:"${pool_address}"}){
          token0 {
            id
            symbol
          }
          token1 {
            id
            symbol
          }
          amount0
          amount1
          amountUSD
      }
    }`;
    try {
      const data0 = await appoloClient.query({
        query: gql(query2),
      });
      const pool_data = data0.data.swaps[0];
      if (pool_data.token0.id.toLowerCase() == token_address.toLowerCase()) {
        valueToken = Number(pool_data.amount1) / Number(pool_data.amount0);
        valueEth = Number(pool_data.amountUSD)/Number(pool_data.amount1);
      } else {
        valueToken = Number(pool_data.amount0) / Number(pool_data.amount1);
        valueEth = Number(pool_data.amountUSD)/Number(pool_data.amount0);
      }
      
    } catch (error) {
      console.error("Error:", error);
    }
  } else {
    const query2 = `
    query {
      swaps(first:1, orderDirection:desc,orderBy:timestamp,
        where:{pair:"${pool_address}"}){
          pair{
            token0 {
              id
              symbol
            }
            token1 {
              id
              symbol
            }

          }
          amount0In
          amount1In
          amount0Out
          amount1Out
          amountUSD
      }
    }`;
    try {
      const data0 = await appoloClient.query({
        query: gql(query2),
      });
      const pool_data = data0.data.swaps[0];

      if (pool_data.pair.token0.id == token_address) {
        valueToken = (pool_data.amount1In+pool_data.amount1Out) / (pool_data.amount0In+pool_data.amount0Out);
        valueEth =  pool_data.amountUSD/ (pool_data.amount1In+pool_data.amount1Out);
      } else {
        valueToken = (pool_data.amount0In+pool_data.amount0Out) / (pool_data.amount1In+pool_data.amount1Out);
        valueEth =  pool_data.amountUSD/ (pool_data.amount0In+pool_data.amount0Out);
      }
    } catch (error) {
      console.log(error);
    }
  }
  return {valueToken:Math.abs(valueToken),valueEth:Math.abs(valueEth)}

}

async function getTotalSupply(tokenAddress) {
  try {
    const provider = ethers.getDefaultProvider(
      "https://mainnet.infura.io/v3/c558761fd1204a879c54d5187f0ef53f"
    );
    const abi = ["function totalSupply() view returns (uint256)"];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const totalSupply = await contract.totalSupply();
    return totalSupply.toString();
  } catch (error) {
    console.error("Error:", error);
    return 0;
  }
}
async function checkFresh(lpaddress,trader_address,version){
  try {
    const querySwapV2 = `
        query {
            swaps(
              first:10,orderBy: timestamp, orderDirection: desc,where:{ from:"${trader_address}", pair_not: "${lpaddress}"}
            ) {
                id
             }
            }        
        `;

    const querySwapV3 = `
        query {
            swaps(first:10,orderBy: timestamp, orderDirection: desc,where:{pool_not:"${lpaddress}",origin:"${trader_address}"}
            ) {
              id
             }
            }   
        `;
    
   
    const query = gql(version == 2 ? querySwapV2 : querySwapV3);

    const appoloClient = APPOLO(1, version);
    const data0 = await appoloClient.query({
      query: query,
    });
    if (data0?.data?.swaps.length > 0) {
      return false;
    } else {
      const querySwapV2 = `
          query {
              swaps(
                first:1,orderBy: timestamp,where:{ from:"${trader_address}"}
              ) {
                  id
                  trasnaction {
                    blockNumber
                  }
              }
              }        
          `;

      const querySwapV3 = `
          query {
              swaps(first:1,orderBy: timestamp,where:{origin:"${trader_address}"}
              ) {
                id
                trasnaction {
                  blockNumber
                }
              }
              }   
          `;
      
    
      const query = gql(version == 2 ? querySwapV2 : querySwapV3);

      const appoloClient = APPOLO(1, version);
      const data0 = await appoloClient.query({
        query: query,
      });
      
    //check token transfer
      return await checkEmptyTransferToken(trader_address,data0?.data?.swaps[0].transaction.blockNumber-1);
    }
  } catch (error) {
    console.error("Fresh:", error);
    process.exit();
  }

}

async function checkEmptyTransferToken(trader_address,block){
    
  const filter = {
    fromBlock:block-2000,
    toBlock: block,
    topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            null,
            ethers.utils.hexZeroPad(trader_address, 32)
            ],
  };
  const logList = await provider.getLogs(filter);
  if(logList.length>0) return false;
  return true;
}
async function getSwaps(lpaddress, trader_address, version) {
  try {
    const querySwapV2 = `
        query {
            swaps(
              first:1000,orderBy: timestamp, orderDirection: desc,where:{ from:"${trader_address}", pair: "${lpaddress}"}
            ) {
                from
                transaction{
                    blockNumber
                    swaps{
                        id
                    }
                }                
                pair{
                  token0 {
                    id
                }
                token1 {
                    id
                  }
                }
                amount0In,
                amount0Out,
                amount1In,
                amount1Out,
                amountUSD
             }
            }        
        `;

    const querySwapV3 = `
        query {
            swaps(first:1000,orderBy: timestamp, orderDirection: desc,where:{pool:"${lpaddress}",origin:"${trader_address}"}
            ) {

                origin
                transaction{
                    id
                    blockNumber
                    swaps{
                        id
                    }
                }                
                token0 {
                  id
                }
                token1 {
                  id
                }
                amount0
                amount1
                amountUSD
             }
            }   
        `;

    const query = gql(version == 2 ? querySwapV2 : querySwapV3);

    const appoloClient = APPOLO(1, version);
    const data0 = await appoloClient.query({
      query: query,
    });
    if (data0?.data?.swaps.length > 0) {
      return data0?.data?.swaps;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error:", error);
  }
  return [];
}

const getTrading = async (lpaddress, trader_address, token, version) => {
  const books = await getSwaps(lpaddress, trader_address, version);
  let position = {},
    trades = [],
    totalProfit = 0,
    totalProfit_roi = 0,
    winCounter = 0,
    lossCounter = 0,
    winRate = 0,
    totalBuy=0,
    initEth=0;
  
  const price_eth = await get_token_price_eth(token,lpaddress,version)
  
  for (let i = books.length - 1; i >= 0; i--) {
    const tr = books[i];
    let tradingAmount, usdAmount,ethAmount, side, rate;
    usdAmount = Number(tr.amountUSD)
    if(version==2) {
            
      if(tr.pair.token0.id.toLowerCase()==token.toLowerCase()){//token0
          if(tr.amount0In>0){
              side='sell';
              tradingAmount = tr.amount0In;
              ethAmount = tr.amount1Out;
          }else{
              side='buy';
              tradingAmount = tr.amount0Out;
              ethAmount = tr.amount1In;
              
          }
      }else{//token1
          if(tr.amount1In>0){
              side='sell';
              tradingAmount = tr.amount1In;
              ethAmount = tr.amount0Out;
          }else{
              side='buy';
              tradingAmount = tr.amount1Out;
              ethAmount = tr.amount0In;
          }
      }
  }else{
      if(tr.token0.id.toLowerCase()==token.toLowerCase()){//token0
          if(tr.amount0>0){
              side='sell';
              tradingAmount = tr.amount0;
              ethAmount = -tr.amount1;
          }else{
              side='buy';
              tradingAmount = -tr.amount0;
              ethAmount = tr.amount1;
          }
      }else{//token1
          if(tr.amount1>0){
              side='sell';
              tradingAmount = tr.amount1;
              ethAmount = -tr.amount0;
          }else{
              side='buy';
              tradingAmount = -tr.amount1;
              ethAmount = tr.amount0;
          }
      }

  }
    ethAmount = Number(ethAmount);
    tradingAmount = Number(tradingAmount);
    rate = ethAmount / tradingAmount;
    ethRate = usdAmount/ethAmount;
    
    if (side == "buy") {
      totalBuy++;
      let cum_quote = position.balance ? position.avg * position.balance : 0;
      if(initEth==0){
        initEth = await getEthBalance(trader_address,"0x"+(tr.transaction.blockNumber-1).toString(16));
      }
      let newBalance = position.balance
        ? position.balance + tradingAmount
        : tradingAmount;

      let avg = (cum_quote + ethAmount) / newBalance;
      
      position = {  
        balance: newBalance,
        avg,
        initEth
      };
      
    } else {
      if (position.balance && position.balance > tradingAmount) {
        const open_price = position.avg;
        const close_price = rate;
        const amount = tradingAmount;
        
        const profit = (close_price - open_price) * amount*ethRate;
        
        if (profit > 0) {
          winCounter++;
        } else {
          lossCounter++;
        }
        const profit_roi = (close_price - open_price) * amount/initEth;
        totalProfit = totalProfit + profit;
        totalProfit_roi = totalProfit_roi + profit_roi;
        const newBalance = position.balance - tradingAmount;
        
        trades.push({
          open_price,
          close_price,
          amount,
          profit,
          profit_roi,
          closemode: newBalance <= 0.000001 ? "full" : "half",
          last_balance: newBalance,
        });
        position = {
          balance: newBalance,
          avg: open_price,
          initEth
        };
      }
    }

  }
  
  const totalTrades = trades.length;
  winCounter + lossCounter;
  if (totalTrades == 0) {
    winRate = 0;
  } else {
    winRate = (winCounter / totalTrades)*100 ;
  }
  const remainProfit = position.balance>0?(price_eth.valueToken - position.avg) * position.balance*price_eth.valueEth:0;
  const remainRoi = initEth==0?0:position.balance*price_eth.valueToken/ initEth;

  totalProfit_roi = totalProfit_roi+remainRoi;
  totalProfit = totalProfit+remainProfit ;
  return {
    position,
    trades,
    totalProfit,
    totalProfit_roi,
    winRate,
    totalTrades,
    totalBuy
  };
};

const checkMEV = async (trader_address, version) => {
  try {
    const querySwapV2 = `
          query {
              swaps(
                first:50,orderBy: timestamp, orderDirection: desc,where:{ from:"${trader_address}"}
              ) {
                  sender
                  from
                  to
                  transaction{
                      swaps{
                          id
                      }
                  }                
               }
          }        
          `;
    const querySwapV3 = `
          query {
              swaps(
                first:1000,orderBy: timestamp, orderDirection: desc,where:{ origin :"${trader_address}"}
              ) {
                  sender
                  recipient
                  origin
                  transaction{
                    swaps{
                        id
                    }
                  }                
               }
          }        
          `;
    const q= version==2?querySwapV2:querySwapV3;
    const query = gql(q);

    const appoloClient = APPOLO(1, version);
    const data0 = await appoloClient.query({
      query: query,
    });
    if (data0?.data?.swaps.length > 0) {
      let mev = false;
      for (let index = 0; index < data0?.data?.swaps.length; index++) {
        if (data0?.data?.swaps[index].transaction.swaps.length > 1) {
          mev = true;
          break;
        }
        if(version==2){
          if (data0?.data?.swaps[index].from!=data0?.data?.swaps[index].to) {
            mev = true;
            break;
          }
        }else{
          if (data0?.data?.swaps[index].origin!=data0?.data?.swaps[index].recipient) {
            mev = true;
            break;
          }
        }
      }
      return mev;
    } else {
      return false;
    }
  } catch (e) {
    console.log('==================================',e);
    return false;
  }
};

async function getEthBalance(trader,blockNumber){
  const balance = await provider.getBalance(trader,blockNumber);
  return Number(balance)/Math.pow(10,18);
}
async function test(){

  const lp = "0xdf8ef47910ce4a196f83b86b80809f1c5201650a";
  const trader = "0x3FBD03d8495FF7CBaDE59b9e4cb3c13f729D967B";
  const token = "0x561cf9121e89926c27fa1cfc78dfcc4c422937a4";
  
  // console.log(
  //   await getTrading(
  //       lp,
  //       trader,
  //       token,
  //       2)
  // )

  console.log(await checkEmptyTransferToken("0xedf49ef9665a987d429261ff7cdf7ac39be3033d",18597830))
}
//test();
module.exports = {
  getPool,
  get_token_price,
  get_token_price_eth,
  getTotalSupply,
  getTrading,
  checkMEV,
  checkFresh,
};
