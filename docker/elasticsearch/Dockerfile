FROM docker.elastic.co/elasticsearch/elasticsearch:8.15.0

# 安裝 IK Analyzer 插件
# IK Analyzer GitHub: https://github.com/infinilabs/analysis-ik
# 使用官方 CDN 下載地址：https://get.infini.cloud/elasticsearch/analysis-ik/8.15.0
USER root

# 安裝必要的工具
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# 下載並安裝 IK Analyzer 插件
RUN cd /tmp && \
    curl -L -o ik.zip 'https://get.infini.cloud/elasticsearch/analysis-ik/8.15.0' && \
    /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch file:///tmp/ik.zip && \
    rm -f ik.zip

# 設置權限
RUN chown -R elasticsearch:elasticsearch /usr/share/elasticsearch
USER elasticsearch

