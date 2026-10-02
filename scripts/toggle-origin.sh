#!/bin/sh

set -eu

github_url='https://github.com/danyel/go-guess.git'
forgejo_url='https://forgejo.dev/exr462/go-guess.git'
remote='origin'

current_url=$(git remote get-url "$remote")
case "$current_url" in
	"$github_url")
		target_url=$forgejo_url
		;;
	"$forgejo_url")
		target_url=$github_url
		;;
	*)
		printf 'Refusing to change %s: unrecognized URL %s\n' "$remote" "$current_url" >&2
		exit 1
		;;
esac

git remote set-url "$remote" "$target_url"
if git config --get-all "remote.$remote.pushurl" >/dev/null; then
	git config --replace-all "remote.$remote.pushurl" "$target_url"
fi

printf '%s now uses %s\n' "$remote" "$(git remote get-url "$remote")"
