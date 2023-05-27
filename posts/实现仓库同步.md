---
title: Github actions 实现仓库同步
description: Github actions 实现仓库同步
date: 2023-05-27 14:40:00 +08:00
tags:
  - Blog
---

## 需求背景
最近在调研笔记工具，决定尝试一下 [Obsidian](https://obsidian.md/)，功能比较全面而且可定制性比较强，至于同步方案决定使用 Github。  
既然如此，就想把笔记和博客放在一个仓库里，这样写的时候不用切换仓库了。  
初步想法是同步 Obsidian 仓库时，自动把博客子目录推送到 blog 仓库的相应路径，因为远程仓库都在 GitHub，实现用 [GitHub actions](https://docs.github.com/en/actions)。

## 过程
需求并不复杂，在本地实现无非是复制一下再 push。  
然而事实上我花了半天时间 ~~with chatGPT together~~。  
我对 `GitHub actions` 只是了解，不过之前有写过简单的 `Jenkins pipeline`，想着上手不会很难。

### 初步实现
很快啊，就~~在 GPT 的帮助下~~实现了一版，步骤如下
```yml
# 签出两个仓库
- name: Checkout Repository A
  uses: actions/checkout@v3
  with:
	repository: cybzzz/obsidian
	path: obsidian
        
- name: Checkout Repository B
  uses: actions/checkout@v3
  with:
	repository: cybzzz/blog
	path: blog
# 复制文件并提交
- name: Copy files
  run: |
	rm -rf blog/posts
	mv obsidian/blog blog/posts
	cd blog
	git config user.name "cybzzz"
	git config user.email "cybzzz@foxmail.com"
	git add .
	git commit -m "Sync blog"
# 推送到 blog
- name: Push changes
  uses: ad-m/github-push-action@master
  with:
	github_token: ${{ secrets.ACCESS_TOKEN }}
	repository: cybzzz/blog
	directory: blog
	force: true
```
### 坑
过了一遍，看不出什么问题，直接 push
```shell
remote: Permission to cybzzz/blog.git denied to github-actions[bot].
fatal: unable to access 'xxx': The requested URL returned error: 403
```
em小问题，可能是 token 没配好🤔。

然后就是长达两小时的痛苦历程，包括但不限于
* 修改 `personal access token` 权限
* 重新生成 `personal access token` 
* 反复配置仓库 `secrets`和 `actions`
* 修改 actions 的权限和推送步骤的实现方式
* 遍历 GitHub 文档

甚至把 blog 仓库的依赖机器人都去掉了，就因为它名字有个 `bot`😇

终于终于，在[github-push-action](https://github.com/ad-m/github-push-action)里找到一个 [issue](https://github.com/ad-m/github-push-action/issues/44#issuecomment-581706892)。  
原来真正的原因是 checkout 的时候用了默认的 GITHUB_TOKEN，并且提交历史也不完整。

## 优化
到这里，我已经实现了同步仓库的功能。但是如果我同步 Obsidian 仓库的时候没有对博客子目录进行修改，就不用推送到 blog 仓库。  
用 `git diff`和环境变量进行实现，完整`GitHub actions`文件如下
```yml
name: Sync Blog
on:
  push:
    branches:
      - main

jobs:
  sync:
    runs-on: ubuntu-latest
    env:
      BLOG_CHANGED: false
    steps:
    - name: Checkout Repository A
      uses: actions/checkout@v3
      with:
        repository: cybzzz/obsidian
        path: obsidian
        fetch-depth: 0

    - name: Check if blog has changed
      id: check_changes
      run: |
        cd obsidian
        if git diff --quiet HEAD~1 HEAD blog; then
          echo "blog has not changed"
        else
          echo "blog has changed"
          echo "BLOG_CHANGED=true" >> $GITHUB_ENV
        fi

    - name: Checkout Repository B
      if: ${{ env.BLOG_CHANGED == 'true' }}
      uses: actions/checkout@v3
      with:
        repository: cybzzz/blog
        path: blog
        persist-credentials: false 
        fetch-depth: 0
    - name: Copy files
      if: ${{ env.BLOG_CHANGED == 'true' }}
      run: |
        rm -rf blog/posts
        mv obsidian/blog blog/posts
        cd blog
        git config user.name "cybzzz"
        git config user.email "cybzzz@foxmail.com"
        git add .
        git commit -m "Sync blog"

    - name: Push changes
      if: ${{ env.BLOG_CHANGED == 'true' }}
      uses: ad-m/github-push-action@master
      with:
        github_token: ${{ secrets.ACCESS_TOKEN }}
        repository: cybzzz/blog
        directory: blog
        force: true
```


## 总结
`push` 失败的时候没有仔细考虑`checkout`部分的问题，对于不太熟悉的东西有点依赖 GPT ，排查的时候用了不少的时间去尝试它给出的方法，但是毫无起色😅