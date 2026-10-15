<script>
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
</script>

<h1>c</h1>
<button id="go" onclick={() => goto(resolve("/b/"))}>go to b</button>
