# Qualcomm remote processor manager
A simple GNOME shell extension to manage Snapdragon ADSP and CDSP on computer / IoT platform.

## Result
<img width="2944" height="1840" alt="image" src="https://github.com/user-attachments/assets/4fc32f5a-29aa-45bf-a694-419062952de2" />

## Introduction

Qualcomm's remote processors can be controlled via `sysfs` interface on Linux, Linux's `remoteproc` framework will collect the status of remote processor, and provide a interface for userland programs.</br>

<img width="1428" height="1120" alt="image" src="https://github.com/user-attachments/assets/0fe968d5-a7b7-4b0a-9ec4-619b7f4365b2" />

Although Snapdragon's remote processors are containing "non-free" firmware, we can control them at any time. Use this extension to disable remote processors, never let them doing unknown thing, or speaking unknown languages to protect your privacy!</br>
</br>
The extension itself is just a wrapper to use `cat /sys/class/remoteproc/remoteprocN/name` and `echo "start" > /sys/class/remoteproc/remoteprocN/state` commands to get remote processor's name, and mamage remote processor.

## Usage guide

`git clone` this repository, and move it to `~/.local/share/gnome-shell/extensions` directory, log out. Then you're ready to go!


## Open source license

This program is licensed under GNU GPL V3 license.
