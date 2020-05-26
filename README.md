# AboutTheDrawing
这里记录一下怎么绘出这样

![原始回波](https://github.com/hahabboom/img-store/blob/master/1589438476594.png?raw=true)

这样

![原始回波](https://github.com/hahabboom/img-store/blob/master/1589438502351.png?raw=true)

这样

![风羽图](https://github.com/hahabboom/img-store/blob/master/1589438758226.png?raw=true)
以及这样

![折射率结构常数](https://github.com/hahabboom/img-store/blob/master/1589438794241.png?raw=true)
等等等等的图。。。。。。。（这些图啥意思我也看不懂。。。反正画就完事了。。。:expressionless:）

1. 首先 ，这些图的数据量很大，一小时会有2、3M，所以后端给的是二进制数据流，我们需要将数据先解析出来
2. 然后根据将数据整合成我们需要的格式（根据不同产品图来调整）
3. 最后就是使用数据来画图了（画图方式有很多，有echarts的画法，也可以用canvas，我这里几个图是用的echarts的方法来绘制）

还有canvas绘制的图，等我整理一下好好做个总结，再传。。。

:expressionless:。。。行吧  步骤很简单。。。绘制方法就看代码吧
