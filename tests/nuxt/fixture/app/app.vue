<template>
  <nav>
    <NuxtLink id="to-a" to="/">a</NuxtLink>
    <NuxtLink id="to-b" to="/b">b</NuxtLink>
    <NuxtLink id="to-c" to="/c">c</NuxtLink>
    <NuxtLink id="named" to="/b" data-turn="named">named</NuxtLink>
    <NuxtLink id="tint" to="/c">tint</NuxtLink>
    <NuxtLink id="card" to="/b">card</NuxtLink>
    <NuxtLink id="hash" to="/b#below">hash</NuxtLink>
    <a id="reload" href="/nuxt/fixture/.output/public/real/" data-turn="reloaded">reload</a>
  </nav>
  <main><NuxtPage /></main>
</template>
