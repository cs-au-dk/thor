
case "$(uname -s)" in

Linux)
	sudo apt-get install cpu-checker
	if [ !$(kvm-ok) ] 
		then
		echo "- KVM is not present in your OS installation"
		exit 1
	fi
	sudo apt-get install qemu-kvm libvirt-bin ubuntu-vm-builder bridge-utils
	echo "Adding the user to the libvirtd group (you need to logout and log back for this to be effective)"
	sudo adduser `id -un` libvirtd
	;
*)
	echo "Environment set-up is only supported on Ubuntu";